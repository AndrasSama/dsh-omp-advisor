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
  advisorMatchesWorkspace,
  normalizeSettings,
  normalizeSettingsLenient
} from './settings'
import { assertAdvisorsRunnable, createSettingsScope } from './settings-scope'
import type {
  AdvisorEntry,
  AdvisorEventEntry,
  AdvisorSettings,
  CordisContextLike,
  PreToolDecision,
  SessionAdvisorSnapshot,
  SessionLike,
  ToolExecLike,
  ToolGateBlock
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
/** Error identity carried on a gate denial, for policy/diagnostics consumers. */
export const ADVISOR_GATE_ERROR_NAME = 'AdvisorToolGateDenied'
/** Stable machine code for a gate denial. */
export const ADVISOR_GATE_CODE = 'ADVISOR_TOOL_GATE'

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
  /**
   * Sessions whose current gate finding already exhausted `maxDenials`, so the
   * stand-down is recorded once instead of on every subsequent tool call.
   */
  private gateStoodDown = new Set<string>()
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
    config: unknown
  ) {
    super(hostCtx as never, SERVICE_NAME)

    // Settings binding, version-adaptive: DSH 0.2 makes a Loader entry's
    // `Config` the settings (validated + defaulted by the Loader, edited through
    // `settings.update`); 0.1.x exposed `settings.register`. See settings-scope.
    this.settingsScope = createSettingsScope(hostCtx, config)

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
    hostCtx.on('tools/pre-execute', async (exec: ToolExecLike, next: () => unknown) => {
      const decision = this.gateDecision(exec)
      // A denied call's body never runs, so there is nothing to snapshot.
      if (decision?.kind === 'deny') return decision
      // Snapshot before a mutation — including one the user is about to approve,
      // because an `ask` also ends this waterfall and would otherwise reach the
      // tool body with no pre-mutation restore point.
      if (MUTATION_TOOLS.has(exec?.name ?? '')) {
        await snapshotBeforeExec(exec, exec?.name ?? 'tool')
      }
      return decision ?? next()
    })

    this.settingsScope.watch((next: unknown) => {
      this.settingsValue = normalizeSettings(next)
      this.applySettings(this.settingsValue)
    })

    if (hostCtx.connection) {
      registerAdvisorRpc(hostCtx, this)
    }
  }

  get settings(): AdvisorSettings {
    return this.settingsValue
  }

  /**
   * Push a settings value into the live runtimes and the memory manager. Shared
   * by the 0.1.x scope watcher and the 0.2 write path: on 0.2 there is no
   * watcher to fire, because a config edit restarts the plugin instead.
   */
  private applySettings(value: AdvisorSettings): void {
    this.memory.updateSettings(value.memory)
    void this.memory.probeAll()
    // A disabled gate keeps no per-session stand-down bookkeeping.
    if (!value.toolGate.enabled) this.gateStoodDown.clear()
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
  }

  /**
   * Tool-call interception (v0.9.0). Evaluated by the host's `tools/pre-execute`
   * waterfall BEFORE the tool body runs, so a verdict here genuinely stops the
   * call — unlike advice, which the model is free to ignore.
   *
   * Returns `undefined` to let the call proceed. The bound (`maxDenials`) is
   * what keeps a disagreeing advisor from deadlocking the agent: after that many
   * refusals for one finding, the gate stands down and the call is allowed. A
   * fresh finding re-arms it.
   */
  private gateDecision(exec: ToolExecLike): PreToolDecision | undefined {
    const gate = this.settingsValue.toolGate
    if (!gate.enabled) return undefined
    const name = exec?.name ?? ''
    const gated = gate.tools.length > 0 ? new Set(gate.tools) : MUTATION_TOOLS
    if (!gated.has(name)) return undefined
    const session = exec?.agent?.session
    if (!session) return undefined
    const id = sessionIdOf(session)
    const runtime = this.runtimes.get(id)
    const block = runtime?.gateBlock()
    if (!block) return undefined
    // A fresh finding resets the bound, so the stand-down flag must reset too.
    if (block.denials === 0) this.gateStoodDown.delete(id)
    if (block.maxDenials > 0 && block.denials >= block.maxDenials) {
      if (!this.gateStoodDown.has(id)) {
        this.gateStoodDown.add(id)
        this.recordEvent('gate-stood-down', {
          sessionId: id,
          advisor: block.advisor,
          detail: `${block.denials} refusals for one finding; allowing "${name}"`
        })
      }
      return undefined
    }
    runtime!.recordGateDenial()
    const attempt = block.denials + 1
    const bound = block.maxDenials > 0 ? ` (${attempt}/${block.maxDenials})` : ''
    const note = block.note.length > EVENT_DETAIL_LIMIT ? `${block.note.slice(0, EVENT_DETAIL_LIMIT)}…` : block.note
    const reason =
      `Advisor "${block.advisor}" raised a ${block.severity}, so the tool gate stopped "${name}" before it ran${bound}: ` +
      `${note}${gate.note ? ` ${gate.note}` : ''}`
    this.recordEvent(gate.mode === 'ask' ? 'gate-ask' : 'gate-denied', {
      sessionId: id,
      advisor: block.advisor,
      detail: `${name}${bound}: ${note}`
    })
    if (gate.mode === 'ask') {
      return {
        kind: 'ask',
        reason,
        displayReason: {
          en: `Advisor "${block.advisor}" raised a ${block.severity}. Allow "${name}"?`,
          zh: `顾问「${block.advisor}」提出了 ${block.severity} 级别的质疑。是否允许执行「${name}」？`
        }
      }
    }
    return {
      kind: 'deny',
      reason,
      info: { name: ADVISOR_GATE_ERROR_NAME, code: ADVISOR_GATE_CODE, reason: note }
    }
  }

  /** The live gate block for a session, for the monitor surfaces. */
  gateBlock(sessionId: string): ToolGateBlock | undefined {
    return this.runtimes.get(sessionId)?.gateBlock()
  }

  /**
   * Clear an armed gate finding. With no sessionId, clears every session's
   * finding. Returns how many were cleared.
   */
  clearToolGate(sessionId?: string): number {
    if (sessionId) {
      const cleared = this.runtimes.get(sessionId)?.clearGate() === true
      this.gateStoodDown.delete(sessionId)
      return cleared ? 1 : 0
    }
    let cleared = 0
    for (const runtime of this.runtimes.values()) if (runtime.clearGate()) cleared++
    this.gateStoodDown.clear()
    return cleared
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
   * Merge a partial settings patch through the Host settings domain and answer
   * the resolved value: on 0.1.x that is the registered scope (schema-resolved,
   * validated, watchers notified); on 0.2 it is the Loader entry's config, and
   * the write restarts the plugin so the replacement service reads the new value.
   * The settings section's write transport is the plugin's own RPC channel, so
   * validation failures surface as thrown errors the RPC layer folds into
   * bad-request (hence the async contract).
   *
   * Returns the NON-destructive editor view so clearing a name/description
   * in the form does not delete the advisor; the runtime's strict value is
   * refreshed separately so an incomplete advisor never runs.
   */
  async updateSettings(patch: unknown): Promise<AdvisorSettings> {
    if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) {
      throw new Error('settings patch must be a plain object')
    }
    // Restate the 0.1.x write-time contract before anything is persisted (see
    // assertAdvisorsRunnable on why this is defensive rather than the real gate).
    assertAdvisorsRunnable({ ...(this.settingsScope.get() as object), ...(patch as object) })
    await this.settingsScope.update(patch)
    this.settingsValue = normalizeSettings(this.settingsScope.get())
    this.applySettings(this.settingsValue)
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
  async setAdvisorWorkspace(advisorName: string, cwd: string, active: boolean): Promise<AdvisorSettings> {
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
    return await this.updateSettings({ advisors })
  }

  /**
   * Atomically append one new advisor (v0.7.6), built by the caller (the sidebar
   * picks the model from the catalog and expands presets client-side). The host
   * re-generates a unique name against the CURRENT settings and sanitizes the
   * entry to known fields, so a concurrent edit is not clobbered and no unknown
   * keys are persisted.
   */
  async addWorkspaceAdvisor(rawEntry: unknown): Promise<AdvisorSettings> {
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
    return await this.updateSettings({ advisors: [...current.advisors, entry] })
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
    this.gateStoodDown.delete(sessionId)
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
    const gate = runtime.gateBlock()
    return {
      sessionId,
      ...runtime.snapshot(),
      ...(count !== undefined ? { restorePoints: count } : {}),
      ...(gate ? { toolGate: gate } : {}),
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
