/**
 * Optional dsh-better-sidebar integration: registers an "Advisors" monitor
 * tab in the sidebar workbench when (and only when) dsh-better-sidebar is
 * installed and active.
 *
 * Detection contract (never a hard dependency):
 *  - `betterSidebar` is NOT in this module's `inject` list — a name there
 *    strands the browser fiber pending forever when the service never
 *    appears (see src/client/index.ts header). We probe at runtime instead.
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
 * tab component and the synchronous tab-strip badge).
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
}

interface SidebarEventView {
  time: number
  kind: string
  advisor?: string
  sessionId?: string
  detail?: string
}

interface SidebarSnapshot {
  sessions?: SidebarSessionView[]
  recentEvents?: SidebarEventView[]
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
const listeners = new Set<() => void>()

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
    .then(result => {
      const value = unwrapRpcResult<SidebarSnapshot>(result, 'advisor snapshot')
      cache = { sessions: value.sessions ?? [], recentEvents: value.recentEvents ?? [] }
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

function AdvisorsMonitorTab(): React.ReactElement {
  const snapshot = useSnapshot()
  const sessions = snapshot?.sessions ?? []
  const events = snapshot?.recentEvents ?? []

  return (
    <div style={panel}>
      {sessions.length === 0 ? (
        <div style={cardStyle}>
          <strong>No advisor sessions</strong>
          <span style={hint}>
            Advisors attach to sessions when the plugin is enabled (Settings → Ward Council → General) and a
            session matches an advisor's workspace patterns.
          </span>
        </div>
      ) : (
        sessions.map(session => (
          <div key={session.sessionId} style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <strong title={session.sessionId}>Session {session.sessionId.slice(0, 8)}</strong>
              <span style={hint}>{session.active ? 'attached' : 'detached'}</span>
              {typeof session.restorePoints === 'number' && session.restorePoints > 0 && (
                <span style={chip}>{session.restorePoints} restore points</span>
              )}
            </div>
            {session.advisors.length === 0 ? (
              <span style={hint}>No advisors matched this session's workspace.</span>
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
        ))
      )}

      <div style={cardStyle}>
        <strong>Activity</strong>
        {events.length === 0 ? (
          <span style={hint}>No advisor activity yet this server run.</span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {events.slice(0, 60).map((event, index) => (
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

/** Synchronous, cheap (runs on every sidebar render): reads the poll cache. */
function badge(): string | number | null {
  const sessions = cache?.sessions ?? []
  const advisors = sessions.flatMap(session => session.advisors)
  if (advisors.length === 0) return null
  const troubled = advisors.filter(
    advisor => advisor.status === 'halted' || advisor.status === 'error' || advisor.lastError
  )
  if (troubled.length > 0) return '!'
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
}): void {
  ctx.effect(() => {
    let disposed = false
    let attempts = 0
    let releasePoll: (() => void) | null = null
    let unregister: (() => void) | null = null
    let probeTimer: ReturnType<typeof setInterval> | null = null

    const tryRegister = (): boolean => {
      if (disposed) return true
      let service: unknown
      try {
        service = (ctx as unknown as Record<string, unknown>).betterSidebar
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
          component: () => React.createElement(AdvisorsMonitorTab)
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
