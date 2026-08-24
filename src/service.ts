/**
 * AdvisorService: attaches a SessionAdvisorRuntime to each live session when
 * the `dsh-omp-advisor` namespace is enabled, feeds step/turn boundaries
 * into the advisor queue, and exposes the `/dsh-omp-advisor` RPC surface.
 */
import { Service } from '@deepseek-ai/cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { registerAdvisorRpc } from './rpc'
import { SessionAdvisorRuntime } from './runtime'
import { SETTINGS_NAMESPACE, advisorSettingsSchema, normalizeSettings, normalizeSettingsLenient } from './settings'
import type { AdvisorSettings, CordisContextLike, SessionAdvisorSnapshot, SessionLike } from './types'

export const SERVICE_NAME = 'dsh-omp-advisor'

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

    hostCtx.on('session/created', (session: SessionLike) => {
      this.attach(session)
    })
    hostCtx.on('session/event', (session: SessionLike, event: { type: string }) => {
      this.onSessionEvent(session, event)
    })
    hostCtx.on('session/disposed', (session: SessionLike) => {
      this.detach(sessionIdOf(session))
    })

    this.settingsScope.watch((next: unknown) => {
      const value = normalizeSettings(next)
      this.settingsValue = value
      if (!value.enabled) {
        for (const [id, runtime] of this.runtimes) {
          runtime.dispose()
          this.runtimes.delete(id)
        }
        return
      }
      for (const runtime of this.runtimes.values()) runtime.rebuild(value)
    })

    if (hostCtx.connection) {
      registerAdvisorRpc(hostCtx, this)
    }
  }

  get settings(): AdvisorSettings {
    return this.settingsValue
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

  private attach(session: SessionLike): void {
    if (!this.settingsValue.enabled) return
    const id = sessionIdOf(session)
    if (this.runtimes.has(id)) return
    const ctx = this.hostCtx
    const runtime = new SessionAdvisorRuntime(
      {
        sessionId: id,
        getAgent: () => ctx.agents.get(id) as never,
        getEvents: () => {
          const agent = ctx.agents.get(id) as { session?: SessionLike } | undefined
          const events = agent?.session?.events ?? (session.events as never)
          return (events ?? []) as never
        },
        cwd: sessionCwd(session),
        llm: ctx.llm,
        makeUserMessage: (text: string) =>
          createUserMessage({
            content: [{ type: 'text', text }],
            source: { kind: 'plugin', plugin: SERVICE_NAME }
          }),
        log: (message, meta) => ctx.logger?.debug?.(`${SERVICE_NAME}: ${message}`, meta ?? {})
      },
      this.settingsValue,
      (text: string) =>
        createUserMessage({
          content: [{ type: 'text', text }],
          source: { kind: 'plugin', plugin: SERVICE_NAME }
        })
    )
    this.runtimes.set(id, runtime)
  }

  private onSessionEvent(session: SessionLike, event: { type: string }): void {
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
    }
  }

  private detach(sessionId: string): void {
    const runtime = this.runtimes.get(sessionId)
    if (!runtime) return
    runtime.dispose()
    this.runtimes.delete(sessionId)
  }

  /** Snapshot one session's advisor state for the RPC surface. */
  snapshot(sessionId: string): SessionAdvisorSnapshot {
    const runtime = this.runtimes.get(sessionId)
    if (!runtime) {
      return { sessionId, active: false, advisors: [], recentNotes: [] }
    }
    return { sessionId, ...runtime.snapshot() }
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
}
