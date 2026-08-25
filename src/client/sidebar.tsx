/**
 * Optional dsh-better-sidebar integration: registers an "Advisors" monitor
 * tab in the sidebar workbench when (and only when) dsh-better-sidebar is
 * installed and active.
 *
 * Detection contract (never a hard dependency):
 *  - `betterSidebar` is NOT in this module's `inject` list — a name there
 *    strands the browser fiber pending forever when the service never
 *    appears (see src/client/index.ts header). We probe at runtime instead.
 *  - The probe uses `ctx.get('betterSidebar')` — the client runtime's
 *    sanctioned OPTIONAL service lookup (dsh-cordis-client-runner: "ctx.get
 *    performs optional lookup; direct ctx.serviceName access is gated by the
 *    fiber's inject declaration"). Direct property access is rejected for
 *    undeclared services, so ctx.get is the only declaration-free read.
 *  - Probe order: try immediately in apply(); if the service is not up yet
 *    (better-sidebar may activate after us), retry once a second for up to
 *    15 attempts, then give up silently. Absent or disabled sidebar ⇒ zero
 *    UI trace and no errors.
 *  - Registration is wrapped in ctx.effect so HMR/disable disposes it via
 *    the disposer registerTab returns (no "already registered" on reload).
 *  - Everything is try/catch-guarded: a hostile or renamed service can
 *    never crash the advisor plugin's client half.
 *
 * Data: the same `/dsh-omp-advisor` snapshot RPC the settings section uses,
 * polled at 2s while registered (shared module-level store feeds both the
 * tab component and the synchronous tab-strip badge). Everything honors the
 * sidebar's session scope: badge, lead card, and activity feed reflect only
 * the scoped session's workspace; other sessions collapse into "Other
 * sessions".
 */
import * as React from 'react'
import { unwrapRpcResult } from './model-catalog'

const { useEffect, useState } = React

const TAB_ID = 'omp-advisor:advisors'
const POLL_MS = 2000
const PROBE_INTERVAL_MS = 1000
const PROBE_MAX_ATTEMPTS = 15

/* ------------------------------ snapshot shapes ------------------------------ */

interface SidebarAdvisorStatus {
  name: string
  status: string
  backlog: number
  reviewsCompleted: number
  adviceDelivered: number
  lastError?: string
}

interface SidebarSessionView {
  sessionId: string
  active: boolean
  advisors: SidebarAdvisorStatus[]
  restorePoints?: number
  title?: string
  cwd?: string
}

interface SidebarEventView {
  time: number
  kind: string
  advisor?: string
  sessionId?: string
  detail?: string
}

interface SidebarSettingsAdvisor {
  name?: string
  enabled?: boolean
  workspaces?: string[]
}

interface SidebarSnapshot {
  sessions?: SidebarSessionView[]
  recentEvents?: SidebarEventView[]
  settings?: { advisors?: SidebarSettingsAdvisor[] }
}

interface ConnectionLike {
  rpc: { call(channel: string, endpoint: string, payload: unknown): Promise<unknown> }
}

/* ------------------------- shared store (badge + tab) ------------------------ */
/* The tab-strip badge callback is synchronous and runs on every sidebar
 * render, so it reads this cache; the poller keeps it fresh independently of
 * whether the tab body is open. */

let cache: SidebarSnapshot | null = null
let connectionRef: ConnectionLike | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let refCount = 0
/** Session the sidebar tab is scoped to (set by the mounted component). */
let scopeWanted: string | null = null
const listeners = new Set<() => void>()

function setScope(sessionId: string | null): void {
  scopeWanted = sessionId
  // Refresh promptly so the scoped session appears without waiting a tick.
  if (refCount > 0) pollOnce()
}

function notify(): void {
  for (const listener of [...listeners]) {
    try {
      listener()
    } catch {
      // A broken subscriber must not stop the others.
    }
  }
}

function pollOnce(): void {
  const connection = connectionRef
  if (!connection) return
  connection.rpc
    .call('/dsh-omp-advisor', 'snapshot', {})
    .then(async result => {
      const value = unwrapRpcResult<SidebarSnapshot>(result, 'advisor snapshot')
      let sessions = value.sessions ?? []
      // The aggregate lists only advisor-attached sessions; when the tab is
      // scoped to a session without advisors, fetch its (empty) snapshot so
      // the panel can still name it and explain why nobody is attached.
      const scope = scopeWanted
      if (scope && !sessions.some(session => session.sessionId === scope)) {
        try {
          const one = unwrapRpcResult<SidebarSessionView>(
            await connection.rpc.call('/dsh-omp-advisor', 'snapshot', { sessionId: scope }),
            'scoped session snapshot'
          )
          if (one && one.sessionId) sessions = [...sessions, one]
        } catch {
          // Scoped fetch is best-effort.
        }
      }
      cache = {
        sessions,
        recentEvents: value.recentEvents ?? [],
        settings: value.settings
      }
      notify()
    })
    .catch(() => {
      // Keep the last good cache; the settings panel surfaces hard errors.
    })
}

function acquire(connection: ConnectionLike): () => void {
  connectionRef = connection
  refCount += 1
  if (refCount === 1) {
    pollOnce()
    pollTimer = setInterval(pollOnce, POLL_MS)
  }
  return () => {
    refCount = Math.max(0, refCount - 1)
    if (refCount === 0 && pollTimer !== null) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }
}

function useSnapshot(): SidebarSnapshot | null {
  const [, setTick] = useState(0)
  useEffect(() => {
    const listener = (): void => setTick(tick => tick + 1)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])
  return cache
}

/* --------------------------------- styles ----------------------------------- */

const STATUS_COLORS: Record<string, string> = {
  running: '#4caf7d',
  paused: '#c9a227',
  quota_exhausted: '#e08a3c',
  error: '#dc5050',
  halted: '#dc5050',
  no_model: '#8a8a8a'
}

const KIND_COLORS: Record<string, string> = {
  advice: '#4caf7d',
  'review-done': '#7da7d9',
  'review-failed': '#dc7070',
  retry: '#c9a227',
  quota: '#e08a3c',
  halted: '#dc5050',
  intervention: '#dc5050',
  'restore-point': '#9a7fd1',
  'continue-sent': '#c9a227',
  'backlog-dropped': '#e08a3c',
  attach: '#8a8a8a',
  detach: '#8a8a8a'
}

const panel: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: 12,
  fontSize: 13,
  height: '100%',
  overflowY: 'auto'
}
const cardStyle: React.CSSProperties = {
  border: '1px solid var(--dsh-border, rgba(128,128,128,0.25))',
  borderRadius: 10,
  padding: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 6
}
const hint: React.CSSProperties = { opacity: 0.6, fontSize: 12 }
const chip: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: 999,
  padding: '1px 8px',
  border: '1px solid var(--dsh-border, rgba(128,128,128,0.25))',
  fontSize: 11
}

function formatTime(time: number): string {
  const date = new Date(time)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/* ------------------------------- tab component ------------------------------- */

/** Client mirror of the host's advisorMatchesWorkspace (substring patterns, '=' = exact). */
function matchesWorkspace(patterns: string[] | undefined, cwd: string | undefined): boolean {
  const list = (patterns ?? []).map(pattern => pattern.trim()).filter(pattern => pattern !== '')
  if (list.length === 0) return true
  if (!cwd) return false
  return list.some(pattern =>
    pattern.startsWith('=') ? cwd === pattern.slice(1).trim() : cwd.includes(pattern)
  )
}

function basename(path: string | undefined): string | undefined {
  if (!path) return undefined
  const parts = path.split('/').filter(Boolean)
  return parts.length > 0 ? parts[parts.length - 1] : path
}

function AdvisorsMonitorTab(props: { scopedSessionId?: string }): React.ReactElement {
  const snapshot = useSnapshot()
  const scoped = props.scopedSessionId

  // Tell the poller which session this sidebar instance belongs to, so the
  // aggregate (attached sessions only) is merged with the scoped session's
  // own snapshot even when no advisors are attached to it.
  useEffect(() => {
    setScope(scoped ?? null)
    return () => setScope(null)
  }, [scoped])

  const sessions = [...(snapshot?.sessions ?? [])].sort((a, b) => {
    if (a.sessionId === scoped) return -1
    if (b.sessionId === scoped) return 1
    return 0
  })
  const events = snapshot?.recentEvents ?? []
  const configured = snapshot?.settings?.advisors ?? []

  const renderSessionCard = (session: SidebarSessionView): React.ReactElement => {
    const isScoped = session.sessionId === scoped
    const name = session.title || `Session ${session.sessionId.slice(0, 8)}`
    const dir = basename(session.cwd)
    const matching = session.cwd
      ? configured.filter(entry => entry.enabled !== false && matchesWorkspace(entry.workspaces, session.cwd))
      : []
    return (
      <div
        key={session.sessionId}
        style={{
          ...cardStyle,
          ...(isScoped ? { borderColor: 'var(--dsh-accent, #4d6bfe)' } : {})
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <strong title={session.sessionId}>{name}</strong>
          {isScoped && <span style={chip}>this session</span>}
          <span style={hint}>{session.active ? 'attached' : 'not attached'}</span>
          {dir && (
            <span style={chip} title={session.cwd}>
              {dir}
            </span>
          )}
          {typeof session.restorePoints === 'number' && session.restorePoints > 0 && (
            <span style={chip}>{session.restorePoints} restore points</span>
          )}
        </div>
        {session.advisors.length === 0 ? (
          <>
            <span style={hint}>No advisors are attached to this session.</span>
            {matching.length > 0 ? (
              <span style={hint}>
                Configured for this workspace: {matching.map(entry => entry.name || 'unnamed').join(', ')} —
                they attach on the session's next event once the master switch is on (Settings → Ward
                Council → General).
              </span>
            ) : (
              <span style={hint}>
                No enabled advisor's workspace patterns match{session.cwd ? ' this workspace' : ''} — edit
                them in Settings → Ward Council → Advisors / Workspaces.
              </span>
            )}
          </>
        ) : (
          session.advisors.map(advisor => (
            <div
              key={advisor.name}
              style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
            >
              <span
                title={advisor.status}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: STATUS_COLORS[advisor.status] ?? '#8a8a8a',
                  display: 'inline-block'
                }}
              />
              <span style={{ fontWeight: 600 }}>{advisor.name}</span>
              <span style={hint}>{advisor.status}</span>
              <span style={chip}>{advisor.reviewsCompleted} reviews</span>
              <span style={chip}>{advisor.adviceDelivered} advice</span>
              {advisor.backlog > 0 && <span style={chip}>{advisor.backlog} queued</span>}
              {advisor.lastError && (
                <span style={{ ...hint, color: '#dc7070' }} title={advisor.lastError}>
                  ⚠ {advisor.lastError.length > 80 ? `${advisor.lastError.slice(0, 80)}…` : advisor.lastError}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    )
  }

  // Workspace rules: when the tab is scoped to a conversation, that session's
  // card leads and everything else collapses into "Other sessions"; the
  // activity feed narrows to the scoped session too. Without a scope (should
  // not happen inside better-sidebar, defensive) fall back to the full list.
  const scopedSession = scoped ? sessions.find(session => session.sessionId === scoped) : undefined
  const others = scoped ? sessions.filter(session => session.sessionId !== scoped) : []
  const visibleEvents = scoped
    ? events.filter(event => !event.sessionId || event.sessionId === scoped)
    : events

  const detailsStyle: React.CSSProperties = {
    border: '1px solid var(--dsh-border, rgba(128,128,128,0.2))',
    borderRadius: 10,
    padding: '6px 10px'
  }

  return (
    <div style={panel}>
      {scoped && !scopedSession && (
        <div style={cardStyle}>
          <strong>No advisors in this workspace</strong>
          <span style={hint}>
            No advisor data for this session yet — the master switch is off (Settings → Ward Council →
            General), or no configured advisor's workspace patterns match this session's workspace.
          </span>
        </div>
      )}
      {!scoped && sessions.length === 0 && (
        <div style={cardStyle}>
          <strong>No advisor sessions</strong>
          <span style={hint}>
            Advisors attach to sessions when the plugin is enabled (Settings → Ward Council → General) and a
            session matches an advisor's workspace patterns.
          </span>
        </div>
      )}
      {scopedSession && renderSessionCard(scopedSession)}
      {!scoped && sessions.map(renderSessionCard)}
      {others.length > 0 && (
        <details style={detailsStyle}>
          <summary style={{ cursor: 'pointer', opacity: 0.7, fontSize: 12 }}>
            Other sessions ({others.length})
          </summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
            {others.map(renderSessionCard)}
          </div>
        </details>
      )}

      <div style={cardStyle}>
        <strong>{scoped ? 'Activity — this session' : 'Activity'}</strong>
        {visibleEvents.length === 0 ? (
          <span style={hint}>
            {scoped ? 'No activity for this session yet.' : 'No advisor activity yet this server run.'}
          </span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {visibleEvents.slice(0, 60).map((event, index) => (
              <div key={`${event.time}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ ...hint, fontVariantNumeric: 'tabular-nums' }}>{formatTime(event.time)}</span>
                <span
                  style={{
                    ...chip,
                    borderColor: KIND_COLORS[event.kind] ?? undefined,
                    color: KIND_COLORS[event.kind] ?? undefined
                  }}
                >
                  {event.kind}
                </span>
                {event.advisor && <span style={{ fontWeight: 600 }}>{event.advisor}</span>}
                {event.detail && <span style={hint}>{event.detail}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------ icon + badge -------------------------------- */

function AdvisorIcon({ size }: { size: number }): React.ReactElement {
  // Simple "watching eye" mark.
  return React.createElement(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round'
    },
    React.createElement('path', { d: 'M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z' }),
    React.createElement('circle', { cx: 12, cy: 12, r: 3 })
  )
}

function hasTrouble(advisors: SidebarAdvisorStatus[]): boolean {
  return advisors.some(advisor => advisor.status === 'halted' || advisor.status === 'error' || advisor.lastError)
}

/**
 * Synchronous, cheap (runs on every sidebar render): reads the poll cache.
 * Follows workspace rules — better-sidebar passes the tab's session scope, so
 * the badge counts only THIS session's advisors (null when none are attached
 * here); other workspaces' advisors never light it up. Without a scope the
 * badge falls back to the global count.
 */
function badge(...args: unknown[]): string | number | null {
  const scope = args[1] as { sessionId?: string } | undefined
  const sessions = cache?.sessions ?? []
  if (scope?.sessionId) {
    const target = sessions.find(session => session.sessionId === scope.sessionId)
    if (!target || target.advisors.length === 0) return null
    if (hasTrouble(target.advisors)) return '!'
    return target.advisors.length
  }
  const advisors = sessions.flatMap(session => session.advisors)
  if (advisors.length === 0) return null
  if (hasTrouble(advisors)) return '!'
  return advisors.length
}

/* -------------------------------- registration ------------------------------- */

interface BetterSidebarLike {
  registerTab(descriptor: {
    id: string
    title: string | (() => string)
    icon?: unknown
    order?: number
    single?: boolean
    badge?: (...args: unknown[]) => string | number | null | undefined
    component: (props: unknown) => React.ReactNode
  }): () => void
}

function looksLikeBetterSidebar(value: unknown): value is BetterSidebarLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as BetterSidebarLike).registerTab === 'function'
  )
}

/**
 * Probe-and-register. Returns the disposer chain (probe timer + tab
 * registration + poller) for ctx.effect. Safe to call once from apply().
 */
export function mountAdvisorSidebarTab(ctx: {
  connection?: ConnectionLike
  effect(factory: () => unknown, label?: string): void
  logger?: { info?(...args: unknown[]): void }
  get?(name: string): unknown
}): void {
  ctx.effect(() => {
    let disposed = false
    let attempts = 0
    let releasePoll: (() => void) | null = null
    let unregister: (() => void) | null = null
    let probeTimer: ReturnType<typeof setInterval> | null = null

    const tryRegister = (): boolean => {
      if (disposed) return true
      // OPTIONAL service lookup via ctx.get — the runtime's sanctioned way to
      // read a service WITHOUT declaring it in `inject` (dsh-cordis-client-
      // runner: "ctx.get(name) performs optional lookup; direct ctx.serviceName
      // access is gated by the fiber's inject declaration"). Direct property
      // access throws "cannot get property without inject" and would never see
      // the service; declaring it in inject would strand our whole fiber when
      // better-sidebar is absent. ctx.get returns undefined until the
      // providing fiber is active, hence the bounded retry below.
      let service: unknown
      try {
        service = typeof ctx.get === 'function' ? ctx.get('betterSidebar') : undefined
      } catch {
        return false
      }
      if (!looksLikeBetterSidebar(service)) return false
      try {
        unregister = service.registerTab({
          id: TAB_ID,
          title: () => 'Advisors',
          icon: (size: number) => React.createElement(AdvisorIcon, { size }),
          order: 60,
          single: true,
          badge,
          component: (scopeProps: unknown) =>
            React.createElement(AdvisorsMonitorTab, {
              scopedSessionId: (scopeProps as { scope?: { sessionId?: string } } | undefined)?.scope
                ?.sessionId
            })
        })
        if (ctx.connection) releasePoll = acquire(ctx.connection)
        ctx.logger?.info?.('dsh-omp-advisor: registered Advisors tab in dsh-better-sidebar')
      } catch (error) {
        ctx.logger?.info?.(
          `dsh-omp-advisor: better-sidebar registration skipped (${String(error instanceof Error ? error.message : error)})`
        )
        return true // Service exists but rejected us; stop probing.
      }
      return true
    }

    if (!tryRegister()) {
      probeTimer = setInterval(() => {
        attempts += 1
        if (tryRegister() || attempts >= PROBE_MAX_ATTEMPTS) {
          if (probeTimer !== null) {
            clearInterval(probeTimer)
            probeTimer = null
          }
        }
      }, PROBE_INTERVAL_MS)
    }

    return () => {
      disposed = true
      if (probeTimer !== null) clearInterval(probeTimer)
      if (releasePoll) releasePoll()
      if (unregister) {
        try {
          unregister()
        } catch {
          // Disposal is best-effort.
        }
      }
    }
  }, 'dsh-omp-advisor: better-sidebar tab')
}
