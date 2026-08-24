/**
 * The "OMP Advisor" settings section: master switch, review policy, and the
 * advisor roster with model pickers fed by the DSH model list, plus a live
 * status panel backed by the `/dsh-omp-advisor` RPC channel.
 */
import * as React from 'react'
import { fetchModelCatalog, unwrapRpcResult, type ModelCatalog } from './model-catalog'

const { useCallback, useEffect, useMemo, useState, useSyncExternalStore } = React

/* ------------------------------ local contracts ----------------------------- */

interface AdvisorEntryView {
  name: string
  provider: string
  model: string
  reasoningEffort?: string
  maxTurns: number
  instructions?: string
  enabled?: boolean
}

interface SettingsView {
  enabled: boolean
  reviewTrigger: 'step' | 'turn'
  interruptSeverities: ('nit' | 'concern' | 'blocker')[]
  advisors: AdvisorEntryView[]
}

interface ScopeController {
  getSnapshot(): { status: string; value?: SettingsView }
  subscribe(callback: () => void): () => void
  set(field: string, value: unknown): Promise<void>
}

interface AdvisorStatusView {
  name: string
  status: string
  backlog: number
  reviewsCompleted: number
  adviceDelivered: number
  lastError?: string
}

interface SnapshotView {
  sessions?: { sessionId: string; active: boolean; advisors: AdvisorStatusView[] }[]
}

interface ClientCtx {
  settingsScope: { bind(options: { namespace: string }): ScopeController }
  connection: {
    api: { llm: { models(request: Record<string, never>): Promise<unknown> } }
    rpc: { call(channel: string, endpoint: string, payload: unknown): Promise<unknown> }
  }
}

/* ---------------------------------- styles ---------------------------------- */

const styles: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', gap: 16, fontSize: 13 },
  card: {
    border: '1px solid var(--dsh-border, rgba(128,128,128,0.25))',
    borderRadius: 10,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 10
  },
  row: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  label: { minWidth: 150, opacity: 0.85 },
  input: {
    background: 'var(--dsh-input-bg, rgba(128,128,128,0.08))',
    border: '1px solid var(--dsh-border, rgba(128,128,128,0.25))',
    borderRadius: 6,
    padding: '5px 8px',
    color: 'inherit',
    font: 'inherit'
  },
  select: {
    background: 'var(--dsh-input-bg, rgba(128,128,128,0.08))',
    border: '1px solid var(--dsh-border, rgba(128,128,128,0.25))',
    borderRadius: 6,
    padding: '5px 8px',
    color: 'inherit',
    font: 'inherit',
    maxWidth: 320
  },
  button: {
    border: '1px solid var(--dsh-border, rgba(128,128,128,0.3))',
    borderRadius: 6,
    padding: '5px 12px',
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
    font: 'inherit'
  },
  dangerButton: {
    border: '1px solid rgba(220,80,80,0.5)',
    borderRadius: 6,
    padding: '4px 10px',
    background: 'transparent',
    color: 'rgb(220,110,110)',
    cursor: 'pointer',
    font: 'inherit'
  },
  hint: { opacity: 0.6, fontSize: 12 },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    padding: '2px 10px',
    border: '1px solid var(--dsh-border, rgba(128,128,128,0.25))',
    fontSize: 12
  },
  textarea: {
    background: 'var(--dsh-input-bg, rgba(128,128,128,0.08))',
    border: '1px solid var(--dsh-border, rgba(128,128,128,0.25))',
    borderRadius: 6,
    padding: '6px 8px',
    color: 'inherit',
    font: 'inherit',
    minHeight: 54,
    resize: 'vertical'
  }
}

const STATUS_COLORS: Record<string, string> = {
  running: '#4caf7d',
  paused: '#c9a227',
  quota_exhausted: '#e08a3c',
  error: '#dc5050',
  halted: '#dc5050',
  no_model: '#8a8a8a'
}

/* --------------------------------- component -------------------------------- */

export function createSettingsSection(ctx: ClientCtx): React.ComponentType<{ close?: () => void }> {
  const scope = ctx.settingsScope.bind({ namespace: 'dsh-omp-advisor' })

  return function OmpAdvisorSettingsSection() {
    const snapshot = useSyncExternalStore(
      useCallback((cb: () => void) => scope.subscribe(cb), [scope]),
      useCallback(() => scope.getSnapshot(), [scope])
    )
    const value = snapshot.value
    const [catalog, setCatalog] = useState<ModelCatalog | null>(null)
    const [catalogError, setCatalogError] = useState<string | null>(null)
    const [status, setStatus] = useState<SnapshotView | null>(null)

    useEffect(() => {
      let cancelled = false
      fetchModelCatalog(ctx.connection)
        .then(result => {
          if (!cancelled) setCatalog(result)
        })
        .catch((err: unknown) => {
          if (!cancelled) setCatalogError(String(err instanceof Error ? err.message : err))
        })
      return () => {
        cancelled = true
      }
    }, [])

    useEffect(() => {
      let cancelled = false
      const poll = () => {
        ctx.connection.rpc
          .call('/dsh-omp-advisor', 'snapshot', {})
          .then(result => {
            // rpc.call resolves to the RpcResult itself; unwrap {ok, value}.
            const value = unwrapRpcResult<SnapshotView>(result, 'advisor snapshot')
            if (!cancelled) setStatus(value)
          })
          .catch(() => {
            /* service not mounted yet */
          })
      }
      poll()
      const timer = setInterval(poll, 5000)
      return () => {
        cancelled = true
        clearInterval(timer)
      }
    }, [])

    const write = useCallback(
      (field: string, next: unknown) => {
        void scope.set(field, next)
      },
      [scope]
    )

    const advisors = useMemo<AdvisorEntryView[]>(() => value?.advisors ?? [], [value])

    const updateAdvisor = useCallback(
      (index: number, patch: Partial<AdvisorEntryView>) => {
        const next = advisors.map((entry, i) => (i === index ? { ...entry, ...patch } : entry))
        write('advisors', next)
      },
      [advisors, write]
    )

    const removeAdvisor = useCallback(
      (index: number) => {
        write(
          'advisors',
          advisors.filter((_, i) => i !== index)
        )
      },
      [advisors, write]
    )

    const addAdvisor = useCallback(() => {
      const firstGroup = catalog?.groups.find(group => group.models.length > 0)
      const firstModel = firstGroup?.models[0]
      const baseNames = new Set(advisors.map(entry => entry.name))
      let name = 'advisor'
      let suffix = 2
      while (baseNames.has(name)) name = `advisor-${suffix++}`
      write('advisors', [
        ...advisors,
        {
          name,
          provider: firstGroup?.id ?? '',
          model: firstModel?.id ?? '',
          maxTurns: 4,
          enabled: true
        }
      ])
    }, [advisors, catalog, write])

    if (snapshot.status === 'loading') {
      return <div style={styles.root}>Loading advisor settings…</div>
    }
    if (snapshot.status === 'unavailable' || !value) {
      return (
        <div style={styles.root}>
          <div style={styles.card}>
            <strong>Advisor settings unavailable</strong>
            <span style={styles.hint}>
              The dsh-omp-advisor host service is not mounted. Restart DSH after installing the plugin.
            </span>
          </div>
        </div>
      )
    }

    const severities = value.interruptSeverities ?? ['concern', 'blocker']

    return (
      <div style={styles.root}>
        <div style={styles.card}>
          <div style={styles.row}>
            <label style={styles.label}>
              <input
                type="checkbox"
                checked={value.enabled}
                onChange={event => write('enabled', event.target.checked)}
              />{' '}
              Attach advisors to sessions
            </label>
            <span style={styles.hint}>
              Master switch. When off, no advisor runs and session runtimes are released.
            </span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Review trigger</span>
            <select
              style={styles.select}
              value={value.reviewTrigger}
              onChange={event => write('reviewTrigger', event.target.value)}
            >
              <option value="turn">Turn end — review completed turns</option>
              <option value="step">Step end — review while the turn runs</option>
            </select>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Interrupting severities</span>
            {(['nit', 'concern', 'blocker'] as const).map(severity => (
              <label key={severity}>
                <input
                  type="checkbox"
                  checked={severities.includes(severity)}
                  onChange={event => {
                    const next = event.target.checked
                      ? [...severities, severity]
                      : severities.filter(item => item !== severity)
                    write('interruptSeverities', next)
                  }}
                />{' '}
                {severity}
              </label>
            ))}
            <span style={styles.hint}>Checked severities steer at the nearest step boundary; others ride as non-interrupting context.</span>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.row}>
            <strong>Advisors</strong>
            <span style={styles.hint}>Each advisor reviews transcript updates with its own model and read-only tools.</span>
          </div>

          {catalogError && (
            <div style={styles.hint}>Model list unavailable: {catalogError}</div>
          )}

          {advisors.map((entry, index) => {
            const group = catalog?.groups.find(item => item.id === entry.provider)
            const model = group?.models.find(item => item.id === entry.model)
            const efforts = model?.efforts ?? []
            return (
              <div
                key={`${entry.name}-${index}`}
                style={{
                  border: '1px dashed var(--dsh-border, rgba(128,128,128,0.3))',
                  borderRadius: 8,
                  padding: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8
                }}
              >
                <div style={styles.row}>
                  <input
                    type="checkbox"
                    checked={entry.enabled !== false}
                    onChange={event => updateAdvisor(index, { enabled: event.target.checked })}
                    title="Enable this advisor"
                  />
                  <input
                    style={{ ...styles.input, width: 160 }}
                    value={entry.name}
                    placeholder="advisor name"
                    onChange={event => updateAdvisor(index, { name: event.target.value })}
                  />
                  <select
                    style={styles.select}
                    value={entry.provider}
                    onChange={event => {
                      const nextGroup = catalog?.groups.find(item => item.id === event.target.value)
                      updateAdvisor(index, {
                        provider: event.target.value,
                        model: nextGroup?.models[0]?.id ?? '',
                        reasoningEffort: undefined
                      })
                    }}
                  >
                    <option value="">— provider —</option>
                    {(catalog?.groups ?? []).map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <select
                    style={styles.select}
                    value={entry.model}
                    onChange={event => updateAdvisor(index, { model: event.target.value, reasoningEffort: undefined })}
                  >
                    <option value="">— model —</option>
                    {(group?.models ?? []).map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name || item.id}
                      </option>
                    ))}
                  </select>
                  {efforts.length > 0 && (
                    <select
                      style={styles.select}
                      value={entry.reasoningEffort ?? ''}
                      onChange={event =>
                        updateAdvisor(index, { reasoningEffort: event.target.value || undefined })
                      }
                      title="Reasoning effort"
                    >
                      <option value="">default effort</option>
                      {efforts.map(effort => (
                        <option key={effort.id} value={effort.id}>
                          {effort.name || effort.id}
                        </option>
                      ))}
                    </select>
                  )}
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    max turns
                    <input
                      type="number"
                      min={1}
                      max={10}
                      style={{ ...styles.input, width: 60 }}
                      value={entry.maxTurns}
                      onChange={event => {
                        const parsed = Number.parseInt(event.target.value, 10)
                        if (Number.isFinite(parsed)) {
                          updateAdvisor(index, { maxTurns: Math.min(10, Math.max(1, parsed)) })
                        }
                      }}
                    />
                  </label>
                  <button style={styles.dangerButton} onClick={() => removeAdvisor(index)}>
                    remove
                  </button>
                </div>
                <textarea
                  style={styles.textarea}
                  placeholder="Optional specialization, e.g. 'Focus on security: injection, secrets, unsafe deserialization.'"
                  value={entry.instructions ?? ''}
                  onChange={event => updateAdvisor(index, { instructions: event.target.value })}
                />
              </div>
            )
          })}

          <div>
            <button style={styles.button} onClick={addAdvisor}>
              + Add advisor
            </button>
          </div>
        </div>

        <div style={styles.card}>
          <strong>Live status</strong>
          {!status || !status.sessions || status.sessions.length === 0 ? (
            <span style={styles.hint}>
              {value.enabled
                ? 'No sessions with attached advisors yet. Start a session and advisors will attach.'
                : 'Advisors are disabled.'}
            </span>
          ) : (
            status.sessions.map(session => (
              <div key={session.sessionId} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={styles.hint}>session {session.sessionId}</span>
                <div style={styles.row}>
                  {session.advisors.map(advisor => (
                    <span key={advisor.name} style={styles.chip} title={advisor.lastError ?? ''}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          background: STATUS_COLORS[advisor.status] ?? '#8a8a8a',
                          display: 'inline-block'
                        }}
                      />
                      {advisor.name} · {advisor.status}
                      {advisor.backlog > 0 ? ` · backlog ${advisor.backlog}` : ''}
                      {` · ${advisor.reviewsCompleted} reviews / ${advisor.adviceDelivered} notes`}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div style={styles.hint}>
          Advice semantics ported from oh-my-pi (can1357/oh-my-pi, MIT). Advisors investigate with read-only
          tools and deliver notes as &lt;advisory guidance="weigh, don't blindly obey"&gt; — the primary agent
          decides what to do with them.
        </div>
      </div>
    )
  }
}
