/**
 * AdvisorService: attaches a SessionAdvisorRuntime to each live session when
 * the `dsh-omp-advisor` namespace is enabled, feeds step/turn boundaries
 * into the advisor queue, and exposes the `/dsh-omp-advisor` RPC surface.
 */
import { Service } from '@deepseek-ai/cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import {
  disableAdvisorHere,
  enableAdvisorHere,
  uniqueAdvisorName,
  type WorkspaceAdvisorEntry
} from './advisor-workspace'
import { MemoryManager } from './memory/manager'
import { registerAdvisorRpc } from './rpc'
import { createRestorePoint, pruneRestorePoints } from './restore-points'
import { SessionAdvisorRuntime } from './runtime'
import {
  SETTINGS_NAMESPACE,
  advisorMatchesWorkspace,
  advisorSettingsSchema,
  normalizeSettings,
  normalizeSettingsLenient
} from './settings'
import type {
  AdvisorEntry,
  AdvisorEventEntry,
  AdvisorSettings,
  CordisContextLike,
  SessionAdvisorSnapshot,
  SessionLike
} from './types'

export const SERVICE_NAME = 'dsh-omp-advisor'

/** Tool names snapshotted via tools/pre-execute (fs tools ride the intent events). */
const MUTATION_TOOLS: ReadonlySet<string> = new Set(['bash', 'write', 'edit'])
/** Max time a pre-mutation snapshot may hold the tool path (then the tool proceeds). */
const MUTATION_SNAPSHOT_WAIT_MS = 3000
/** Min gap between mutation-triggered snapshots per session. */
const MUTATION_SNAPSHOT_THROTTLE_MS = 2000
/** Activity ring bound (monitor surfaces read newest-first). */
const EVENT_RING_LIMIT = 100
/** Clip for event detail text (plugin-authored, still kept short). */
const EVENT_DETAIL_LIMIT = 160

function sessionIdOf(session: SessionLike): string {
  return String(session.id)
}

function sessionCwd(session: SessionLike): string {
  const headerCwd = (session.header as { cwd?: string } | undefined)?.cwd
  if (typeof headerCwd === 'string' && headerCwd) return headerCwd
  const metaCwd = (session.meta as { cwd?: string } | undefined)?.cwd
  if (typeof metaCwd === 'string' && metaCwd) return metaCwd
  return process.cwd()
}

export class AdvisorService extends Service {
  static inject = ['agents', 'llm', 'settings', 'connection']

  private runtimes = new Map<string, SessionAdvisorRuntime>()
  /** Session cwd per session id, for workspace-scoped advisor filtering. */
  private sessionCwds = new Map<string, string>()
  /** Latest session title per session id, for the monitor surfaces. */
  private sessionTitles = new Map<string, string>()
  /** Latest restore point sha per session (parent chaining for the ring). */
  private lastPointSha = new Map<string, string>()
  /** Per-session snapshot serialization (keeps parent chaining ordered). */
  private snapshotLocks = new Map<string, Promise<void>>()
  /** Throttle timestamps for mutation-triggered snapshots. */
  private lastMutationSnapshot = new Map<string, number>()
  /** Live restore-point counts per session for the snapshot surface. */
  private restorePointCounts = new Map<string, number>()
  /** Service-wide activity ring for the monitor surfaces (bounded, in-memory). */
  private events: AdvisorEventEntry[] = []
  /** Advisor memory engines (v0.7.0): probing, recall, write gate. */
  private readonly memory: MemoryManager
  private settingsValue: AdvisorSettings
  private settingsScope: {
    get(): unknown
    watch(cb: (next: unknown, prev: unknown) => void): () => void
    update(patch: unknown): unknown
  }

  constructor(
    private readonly hostCtx: CordisContextLike,
    _config: unknown
  ) {
    super(hostCtx as never, SERVICE_NAME)

    this.settingsScope = hostCtx.settings.register(SETTINGS_NAMESPACE, advisorSettingsSchema, {
      applies: 'live',
      validate: (raw: unknown) => {
        const value = normalizeSettings(raw)
        for (const entry of value.advisors) {
          if (!entry.provider || !entry.model) {
            throw new Error(`advisor "${entry.name}" needs both provider and model from the model list`)
          }
        }
      }
    }) as never

    this.settingsValue = normalizeSettings(this.settingsScope.get())

    this.memory = new MemoryManager(
      {
        // Sanctioned optional cross-plugin lookup (never an inject entry):
        // undefined when the provider plugin is absent.
        getService: name => (typeof this.hostCtx.get === 'function' ? this.hostCtx.get(name) : undefined),
        log: (message, meta) => hostCtx.logger?.debug?.(`${SERVICE_NAME}: ${message}`, meta ?? {}),
        recordEvent: (kind, fields) => this.recordEvent(kind, fields)
      },
      this.settingsValue.memory
    )
    void this.memory.probeAll()

    hostCtx.on('session/created', (session: SessionLike) => {
      // Track identity for the monitor surfaces regardless of enablement: the
      // workspace row feeds knownWorkspaces and the title feeds snapshots.
      const id = sessionIdOf(session)
      const cwd = sessionCwd(session)
      if (cwd) this.sessionCwds.set(id, cwd)
      this.foldSessionTitle(session)
      this.attach(session)
    })
    hostCtx.on('session/event', (session: SessionLike, event: { type: string; data?: unknown }) => {
      if (event.type === 'session/title') {
        const title = (event.data as { title?: unknown } | undefined)?.title
        if (typeof title === 'string' && title) this.sessionTitles.set(sessionIdOf(session), title)
        return
      }
      this.onSessionEvent(session, event)
    })
    hostCtx.on('session/disposed', (session: SessionLike) => {
      this.detach(sessionIdOf(session))
    })

    // Pre-mutation restore points (checkpoint-rewind pattern): pass-through
    // waterfall listeners that snapshot the workspace before a mutating tool
    // runs. The snapshot wait is bounded — a tool is never blocked on git.
    const snapshotBeforeExec = async (exec: unknown, label: string): Promise<void> => {
      const session = (exec as { agent?: { session?: SessionLike } } | undefined)?.agent?.session
      if (!session) return
      const pending = this.snapshotWorkspace(session, label, { mutation: true })
      if (!pending) return
      await Promise.race([pending, new Promise(resolve => setTimeout(resolve, MUTATION_SNAPSHOT_WAIT_MS))])
    }
    hostCtx.on('fs/write-intent', (_target: unknown, exec: unknown, next: () => unknown) => {
      return snapshotBeforeExec(exec, 'fs/write-intent').then(next)
    })
    hostCtx.on('fs/edit-intent', (_target: unknown, exec: unknown, next: () => unknown) => {
      return snapshotBeforeExec(exec, 'fs/edit-intent').then(next)
    })
    hostCtx.on('tools/pre-execute', (exec: { name?: string; agent?: { session?: SessionLike } }, next: () => unknown) => {
      if (!MUTATION_TOOLS.has(exec?.name ?? '')) return next()
      return snapshotBeforeExec(exec, exec?.name ?? 'tool').then(next)
    })

    this.settingsScope.watch((next: unknown) => {
      const value = normalizeSettings(next)
      this.settingsValue = value
      this.memory.updateSettings(value.memory)
      void this.memory.probeAll()
      if (!value.enabled) {
        for (const [id, runtime] of this.runtimes) {
          runtime.dispose()
          this.runtimes.delete(id)
        }
        this.sessionCwds.clear()
        return
      }
      for (const [id, runtime] of this.runtimes) {
        const cwd = this.sessionCwds.get(id) ?? ''
        runtime.rebuild(this.scopedSettings(value, cwd))
      }
    })

    if (hostCtx.connection) {
      registerAdvisorRpc(hostCtx, this)
    }
  }

  get settings(): AdvisorSettings {
    return this.settingsValue
  }

  /**
   * Workspace scoping: narrow the roster to advisors whose `workspaces`
   * patterns match the session cwd (advisors with no patterns run everywhere).
   * The runtime only ever sees advisors that apply to its session.
   */
  private scopedSettings(value: AdvisorSettings, cwd: string): AdvisorSettings {
    return {
      ...value,
      advisors: value.advisors.filter(entry => advisorMatchesWorkspace(entry, cwd))
    }
  }

  /**
   * Editor-facing view of the roster: NON-destructive (keeps entries whose
   * name/provider/model is empty mid-edit, no trimming). The settings section
   * folds this into the form, so it must never delete the card being edited.
   * The runtime keeps reading the strict `settings` getter.
   */
  get settingsView(): AdvisorSettings {
    return normalizeSettingsLenient(this.settingsScope.get())
  }

  /**
   * Append one activity entry to the bounded ring (monitor surfaces read it
   * newest-first). Detail text is plugin-authored and clipped; entries are
   * in-memory only and lost on restart — monitoring, not audit.
   */
  recordEvent(kind: string, fields?: { advisor?: string; sessionId?: string; detail?: string }): void {
    const detail = fields?.detail
    this.events.push({
      time: Date.now(),
      kind,
      ...(fields?.advisor ? { advisor: fields.advisor } : {}),
      ...(fields?.sessionId ? { sessionId: fields.sessionId } : {}),
      ...(detail
        ? { detail: detail.length > EVENT_DETAIL_LIMIT ? `${detail.slice(0, EVENT_DETAIL_LIMIT)}…` : detail }
        : {})
    })
    if (this.events.length > EVENT_RING_LIMIT) {
      this.events.splice(0, this.events.length - EVENT_RING_LIMIT)
    }
  }

  /** Activity ring, newest first (for the monitor surfaces). */
  recentEvents(): AdvisorEventEntry[] {
    return [...this.events].reverse()
  }

  /**
   * Workspaces the matrix can offer: union of live session cwds and every
   * pattern currently configured on any advisor (so patterns for workspaces
   * not open in a session stay visible/editable). Sorted + deduped.
   */
  knownWorkspaces(): string[] {
    const known = new Set<string>()
    for (const cwd of this.sessionCwds.values()) {
      if (cwd) known.add(cwd)
    }
    for (const entry of this.settingsValue.advisors) {
      for (const pattern of entry.workspaces ?? []) {
        if (pattern) known.add(pattern)
      }
    }
    return [...known].sort((a, b) => a.localeCompare(b))
  }

  /**
   * Merge a partial settings patch through the Host settings domain
   * (schema-resolved, validated, watchers notified — the same path the
   * settings document uses everywhere else) and answer the resolved value.
   * The settings section's write transport is the plugin's own RPC channel
   * because DSH keeps `settingsScope` persistence loopback-only; validation
   * failures surface as thrown errors the RPC layer folds into bad-request.
   *
   * Returns the NON-destructive editor view so clearing a name/description
   * in the form does not delete the advisor; the runtime's strict value is
   * refreshed separately so an incomplete advisor never runs.
   */
  updateSettings(patch: unknown): AdvisorSettings {
    if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) {
      throw new Error('settings patch must be a plain object')
    }
    this.settingsScope.update(patch)
    this.settingsValue = normalizeSettings(this.settingsScope.get())
    return normalizeSettingsLenient(this.settingsScope.get())
  }

  /**
   * Atomically toggle one advisor's workspace-scoped state (v0.7.6). The sidebar
   * calls this instead of read-modify-writing the whole advisors array: it loads
   * the CURRENT settings (never a stale client cache), applies the pure
   * enable/disable op for just this advisor, and saves — so a concurrent edit in
   * the settings dialog is not clobbered. `active=false` appends an exact
   * `=<cwd>` exclusion to `disabledWorkspaces` (never touching `enabled` or the
   * authored inclusion patterns); `active=true` clears it, turns the advisor on,
   * and ensures its inclusion patterns cover the workspace.
   */
  setAdvisorWorkspace(advisorName: string, cwd: string, active: boolean): AdvisorSettings {
    if (typeof advisorName !== 'string' || advisorName.trim() === '') {
      throw new Error('advisor must be a non-empty string')
    }
    if (typeof cwd !== 'string' || cwd.trim() === '') {
      throw new Error('cwd must be a non-empty string')
    }
    const current = normalizeSettings(this.settingsScope.get())
    if (!current.advisors.some(entry => entry.name === advisorName)) {
      throw new Error(`no advisor named "${advisorName}"`)
    }
    const advisors = active
      ? enableAdvisorHere(current.advisors, advisorName, cwd)
      : disableAdvisorHere(current.advisors, advisorName, cwd)
    return this.updateSettings({ advisors })
  }

  /**
   * Atomically append one new advisor (v0.7.6), built by the caller (the sidebar
   * picks the model from the catalog and expands presets client-side). The host
   * re-generates a unique name against the CURRENT settings and sanitizes the
   * entry to known fields, so a concurrent edit is not clobbered and no unknown
   * keys are persisted.
   */
  addWorkspaceAdvisor(rawEntry: unknown): AdvisorSettings {
    if (typeof rawEntry !== 'object' || rawEntry === null || Array.isArray(rawEntry)) {
      throw new Error('entry must be an object')
    }
    const sent = rawEntry as Partial<AdvisorEntry>
    if (typeof sent.provider !== 'string' || sent.provider.trim() === '') {
      throw new Error('entry.provider must be a non-empty string')
    }
    if (typeof sent.model !== 'string' || sent.model.trim() === '') {
      throw new Error('entry.model must be a non-empty string')
    }
    const current = normalizeSettings(this.settingsScope.get())
    const base = typeof sent.name === 'string' && sent.name.trim() !== '' ? sent.name.trim() : 'advisor'
    const entry: AdvisorEntry = {
      name: uniqueAdvisorName(base, current.advisors),
      provider: sent.provider,
      model: sent.model,
      maxTurns: 4,
      enabled: true,
      ...(Array.isArray(sent.workspaces)
        ? {
            workspaces: sent.workspaces
              .filter((w): w is string => typeof w === 'string' && w.trim() !== '')
              .map(w => w.trim())
          }
        : {}),
      ...(typeof sent.instructions === 'string' && sent.instructions.trim() !== ''
        ? { instructions: sent.instructions }
        : {}),
      ...(Array.isArray(sent.skills)
        ? { skills: sent.skills.filter((s): s is string => typeof s === 'string' && s.trim() !== '') }
        : {}),
      ...(typeof sent.preset === 'string' && sent.preset !== '' ? { preset: sent.preset } : {})
    }
    return this.updateSettings({ advisors: [...current.advisors, entry] })
  }

  /**
   * Create one restore point for a session's workspace (serialized per
   * session so parent chaining stays ordered). Fire-and-forget for turn-end
   * snapshots; pre-mutation callers await the returned promise with a bound.
   * Returns undefined when restore points are off / not a mutation capture.
   */
  private snapshotWorkspace(
    session: SessionLike,
    label: string,
    opts?: { mutation?: boolean; turn?: number }
  ): Promise<void> | undefined {
    if (!this.settingsValue.restorePoints) return undefined
    if (opts?.mutation && this.settingsValue.restorePointOnMutation === false) return undefined
    const id = sessionIdOf(session)
    const cwd = this.sessionCwds.get(id) ?? sessionCwd(session)
    if (opts?.mutation) {
      const last = this.lastMutationSnapshot.get(id) ?? 0
      if (Date.now() - last < MUTATION_SNAPSHOT_THROTTLE_MS) return undefined
      this.lastMutationSnapshot.set(id, Date.now())
    }
    const run = async (): Promise<void> => {
      try {
        const point = await createRestorePoint(cwd, {
          session: id,
          turn: opts?.turn,
          label,
          parentSha: this.lastPointSha.get(id)
        })
        if (point) {
          this.lastPointSha.set(id, point.sha)
          await pruneRestorePoints(cwd, this.settingsValue.restorePointKeep || 20, id)
          const count = this.restorePointCounts.get(id) ?? 0
          this.restorePointCounts.set(id, Math.min(count + 1, this.settingsValue.restorePointKeep || 20))
          this.recordEvent('restore-point', {
            sessionId: id,
            detail: `${label} · ${point.sha.slice(0, 7)}`
          })
        }
      } catch (err) {
        this.hostCtx.logger?.debug?.(`${SERVICE_NAME}: restore point failed`, {
          session: id,
          label,
          error: String(err)
        })
      }
    }
    const prev = this.snapshotLocks.get(id) ?? Promise.resolve()
    const chained = prev.then(run, run)
    this.snapshotLocks.set(id, chained)
    return chained
  }

  /** Pick up a title already present in the session log (late attach / restart). */
  private foldSessionTitle(session: SessionLike): void {
    const events = (session.events ?? []) as Array<{ type: string; data?: unknown }>
    for (let i = events.length - 1; i >= 0; i--) {
      const event = events[i]
      if (event?.type !== 'session/title') continue
      const title = (event.data as { title?: unknown } | undefined)?.title
      if (typeof title === 'string' && title) {
        this.sessionTitles.set(sessionIdOf(session), title)
      }
      return
    }
  }

  private attach(session: SessionLike): void {
    if (!this.settingsValue.enabled) return
    const id = sessionIdOf(session)
    if (this.runtimes.has(id)) return
    const ctx = this.hostCtx
    const cwd = sessionCwd(session)
    this.sessionCwds.set(id, cwd)
    const runtime = new SessionAdvisorRuntime(
      {
        sessionId: id,
        getAgent: () => ctx.agents.get(id) as never,
        getEvents: () => {
          const agent = ctx.agents.get(id) as { session?: SessionLike } | undefined
          const events = agent?.session?.events ?? (session.events as never)
          return (events ?? []) as never
        },
        cwd,
        llm: ctx.llm,
        makeUserMessage: (text: string) =>
          createUserMessage({
            content: [{ type: 'text', text }],
            source: { kind: 'plugin', plugin: SERVICE_NAME }
          }),
        log: (message, meta) => ctx.logger?.debug?.(`${SERVICE_NAME}: ${message}`, meta ?? {}),
        recordEvent: (kind, advisor, detail) =>
          this.recordEvent(kind, { advisor, sessionId: id, ...(detail ? { detail } : {}) }),
        // Advisor memory (v0.7.0): recall rides the review, lessons ride the gate.
        recallMemory: (_advisorName, engineIds, deltaText) =>
          this.memory.recall({ cwd, engineIds, query: deltaText.slice(-4000) }),
        onMemoryLesson: (advisorName, lesson) => {
          const entry = this.settingsValue.advisors.find(advisor => advisor.name === advisorName)
          void this.memory.store({
            sessionId: id,
            cwd,
            advisor: advisorName,
            text: lesson.text,
            tags: lesson.tags,
            engineIds: entry?.memoryEngines
          })
        }
      },
      this.scopedSettings(this.settingsValue, cwd),
      (text: string) =>
        createUserMessage({
          content: [{ type: 'text', text }],
          source: { kind: 'plugin', plugin: SERVICE_NAME }
        })
    )
    this.runtimes.set(id, runtime)
    void this.memory.loadPending(cwd)
    this.recordEvent('attach', { sessionId: id, detail: cwd })
  }

  private onSessionEvent(session: SessionLike, event: { type: string; data?: unknown }): void {
    if (!this.settingsValue.enabled) return
    const runtime = this.runtimes.get(sessionIdOf(session))
    if (!runtime) {
      // A session created before enablement, or a service restart: attach lazily.
      this.attach(session)
      const fresh = this.runtimes.get(sessionIdOf(session))
      if (!fresh) return
      return
    }
    const trigger = this.settingsValue.reviewTrigger
    if (trigger === 'step' && event.type === 'step/end') {
      runtime.enqueueReview(true)
    } else if (event.type === 'turn/end') {
      runtime.enqueueReview(false)
      // Auto-retry hook: watch the turn outcome for primary-model failures.
      runtime.onTurnEnd((event.data as { reason?: unknown } | undefined)?.reason)
      // Restore point at the turn boundary (fire-and-forget, serialized).
      const turn = (event.data as { turn?: unknown } | undefined)?.turn
      this.snapshotWorkspace(session, 'turn', { turn: typeof turn === 'number' ? turn : undefined })
    }
  }

  private detach(sessionId: string): void {
    const runtime = this.runtimes.get(sessionId)
    this.sessionCwds.delete(sessionId)
    this.sessionTitles.delete(sessionId)
    this.lastPointSha.delete(sessionId)
    this.snapshotLocks.delete(sessionId)
    this.lastMutationSnapshot.delete(sessionId)
    this.restorePointCounts.delete(sessionId)
    if (!runtime) return
    runtime.dispose()
    this.runtimes.delete(sessionId)
    this.recordEvent('detach', { sessionId })
  }

  /** Snapshot one session's advisor state for the RPC surface. */
  snapshot(sessionId: string): SessionAdvisorSnapshot {
    const title = this.sessionTitles.get(sessionId)
    const cwd = this.sessionCwds.get(sessionId)
    const identity = {
      ...(title ? { title } : {}),
      ...(cwd ? { cwd } : {})
    }
    const runtime = this.runtimes.get(sessionId)
    if (!runtime) {
      return { sessionId, active: false, advisors: [], recentNotes: [], ...identity }
    }
    const count = this.restorePointCounts.get(sessionId)
    return {
      sessionId,
      ...runtime.snapshot(),
      ...(count !== undefined ? { restorePoints: count } : {}),
      ...identity
    }
  }

  /** List sessions with attached advisor runtimes. */
  activeSessions(): string[] {
    return [...this.runtimes.keys()]
  }

  /** Pause or resume one advisor in one session. */
  setPaused(sessionId: string, advisorName: string, paused: boolean): boolean {
    const runtime = this.runtimes.get(sessionId)
    if (!runtime) return false
    return runtime.setPaused(advisorName, paused)
  }

  /** Trigger an immediate review pass for one session. */
  reviewNow(sessionId: string): boolean {
    const runtime = this.runtimes.get(sessionId)
    if (!runtime) return false
    runtime.enqueueReview(false)
    return true
  }

  /* --------------------------- advisor memory (v0.7.0) -------------------------- */

  /** Memory engine statuses + gate + pending writes (monitor surfaces). */
  memoryView(): ReturnType<MemoryManager['view']> {
    return this.memory.view()
  }

  /** Re-probe every configured memory engine (Memory tab Rescan). */
  async memoryRescan(): Promise<ReturnType<MemoryManager['view']>> {
    await this.memory.probeAll()
    return this.memory.view()
  }

  /** Approve one pending memory write (write gate = approval). */
  async memoryApprove(writeId: string): Promise<{ ok: boolean; detail?: string }> {
    return this.memory.approve(writeId)
  }

  /** Discard one pending memory write. */
  async memoryDiscard(writeId: string): Promise<{ ok: boolean }> {
    return this.memory.discard(writeId)
  }
}
