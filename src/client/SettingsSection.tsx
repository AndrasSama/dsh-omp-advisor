/**
 * The "Ward Council" settings section: master switch, review policy, and the
 * advisor roster with model pickers fed by the DSH model list, plus a live
 * status panel — all backed by the `/dsh-omp-advisor` RPC channel.
 *
 * Reads AND writes ride the plugin's own RPC channel instead of
 * `ctx.settingsScope`: DSH keeps settingsScope persistence loopback-only
 * (remote browsers get a process-local scope whose snapshot is permanently
 * `unavailable`, which would hide this whole section from remote GUIs),
 * while the channel's trusted-host fence works from anywhere the GUI works.
 */
import * as React from 'react'
import { fetchModelCatalog, unwrapRpcResult, type ModelCatalog } from './model-catalog'
import { ADVISOR_PRESETS, findPreset } from './presets'
import { SKILL_CATALOG } from './skill-catalog.generated'

const { useCallback, useEffect, useMemo, useRef, useState } = React

/* ------------------------------ local contracts ----------------------------- */

interface AdvisorEntryView {
  name: string
  provider: string
  model: string
  reasoningEffort?: string
  maxTurns: number
  instructions?: string
  enabled?: boolean
  skills?: string[]
  skillMode?: 'inject' | 'lazy'
  workspaces?: string[]
  preset?: string
}

interface SettingsView {
  enabled: boolean
  reviewTrigger: 'step' | 'turn'
  interruptSeverities: ('nit' | 'concern' | 'blocker')[]
  adviceCoalesceMs: number
  autoRetry: boolean
  autoRetryDelayMs: number
  autoRetryMax: number
  interveneOnBlocker: boolean
  restorePoints: boolean
  restorePointKeep: number
  restorePointOnMutation: boolean
  completionGate: boolean
  minDeltaChars: number
  advisors: AdvisorEntryView[]
}

interface AdvisorStatusView {
  name: string
  status: string
  backlog: number
  reviewsCompleted: number
  adviceDelivered: number
  lastError?: string
}

interface EventEntryView {
  time: number
  kind: string
  advisor?: string
  sessionId?: string
  detail?: string
}

interface SnapshotView {
  sessions?: {
    sessionId: string
    active: boolean
    advisors: AdvisorStatusView[]
    restorePoints?: number
    /** Additive v0.6.3 identity fields — optional: an older host omits them. */
    title?: string
    cwd?: string
  }[]
  settings: SettingsView
  /** Additive v0.6.0 monitor fields — optional: an older host omits them. */
  knownWorkspaces?: string[]
  recentEvents?: EventEntryView[]
}

interface ClientCtx {
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
    maxWidth: 320,
    textAlign: 'left'
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
  },
  /* Inner tab bar, pattern-matched to the Plugin Market's sub-tab row. */
  tabBar: {
    display: 'flex',
    gap: 2,
    borderBottom: '1px solid var(--dsh-border, rgba(128,128,128,0.25))',
    flexWrap: 'wrap'
  },
  tabButton: {
    border: 'none',
    borderBottom: '2px solid transparent',
    background: 'transparent',
    color: 'inherit',
    opacity: 0.7,
    padding: '8px 14px',
    cursor: 'pointer',
    font: 'inherit',
    fontWeight: 500
  },
  tabButtonActive: {
    opacity: 1,
    borderBottom: '2px solid var(--dsh-accent, #4d6bfe)',
    color: 'var(--dsh-accent, #4d6bfe)'
  },
  /* Collapsible advisor card header (always visible). */
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    cursor: 'pointer',
    flexWrap: 'wrap'
  },
  chevron: {
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
    font: 'inherit',
    padding: '0 4px',
    opacity: 0.7
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

/**
 * Comma-separated workspace pattern editor. Keeps a local text buffer so the
 * user can type commas/spaces freely; commits the parsed list on blur/Enter
 * and re-syncs from props when the server value changes underneath.
 */
function WorkspacesInput(props: { value: string[]; onCommit(next: string[]): void }): React.ReactElement {
  const joined = props.value.join(', ')
  const [text, setText] = useState(joined)
  const lastJoined = useRef(joined)
  if (lastJoined.current !== joined) {
    lastJoined.current = joined
    setText(joined)
  }
  const commit = (): void => {
    const next = text
      .split(',')
      .map(part => part.trim())
      .filter(part => part !== '')
    lastJoined.current = next.join(', ')
    setText(next.join(', '))
    props.onCommit(next)
  }
  return (
    <input
      style={{ ...styles.input, flex: 1, minWidth: 220 }}
      placeholder="all workspaces (empty) — or patterns like: Qwest Chain, /home/sama/novels"
      value={text}
      onChange={event => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={event => {
        if (event.key === 'Enter') commit()
      }}
    />
  )
}

/* --------------------------- memoized advisor card --------------------------- */
/*
 * The roster re-renders on every keystroke (optimistic draft overlay), and
 * each card carries large <select>s (provider model list, ~240 packaged
 * skills). Extracting the card into React.memo with stable callbacks means
 * typing in one card re-renders ONLY that card, and memoized option arrays
 * keep React from reconciling hundreds of <option> elements per render.
 */

const PRESET_OPTIONS = ADVISOR_PRESETS.map(preset => (
  <option key={preset.id} value={preset.id} title={preset.description}>
    {preset.name} · {preset.role}
  </option>
))

interface AdvisorCardProps {
  entry: AdvisorEntryView
  index: number
  catalog: ModelCatalog | null
  collapsed: boolean
  onToggleCollapse(index: number): void
  onPatch(index: number, patch: Partial<AdvisorEntryView>): void
  onRemove(index: number): void
}

const AdvisorCard = React.memo(function AdvisorCard({
  entry,
  index,
  catalog,
  collapsed,
  onToggleCollapse,
  onPatch,
  onRemove
}: AdvisorCardProps) {
  const group = catalog?.groups.find(item => item.id === entry.provider)
  const model = group?.models.find(item => item.id === entry.model)
  const efforts = model?.efforts ?? []
  const skills = entry.skills ?? []
  const preset = entry.preset ? findPreset(entry.preset) : undefined
  const incomplete = !entry.provider || !entry.model
  const workspaceCount = entry.workspaces?.length ?? 0

  const providerOptions = useMemo(
    () =>
      (catalog?.groups ?? []).map(item => (
        <option key={item.id} value={item.id}>
          {item.name}
        </option>
      )),
    [catalog]
  )
  const modelOptions = useMemo(
    () =>
      (group?.models ?? []).map(item => (
        <option key={item.id} value={item.id}>
          {item.name || item.id}
        </option>
      )),
    [group]
  )
  const effortOptions = useMemo(
    () =>
      efforts.map(effort => (
        <option key={effort.id} value={effort.id}>
          {effort.name || effort.id}
        </option>
      )),
    // `efforts` derives from `model`; depend on the stable catalog object.
    [model]
  )
  const skillOptions = useMemo(
    () =>
      SKILL_CATALOG.filter(item => !skills.includes(item.id)).map(item => (
        <option key={item.id} value={item.id} title={item.description}>
          {item.id}
        </option>
      )),
    // Only rebuild ~240 options when the skill list itself changes.
    [entry.skills]
  )

  return (
    <div
      style={{
        border: '1px dashed var(--dsh-border, rgba(128,128,128,0.3))',
        borderRadius: 8,
        padding: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 8
      }}
    >
      {/* Header: always visible. Click anywhere on it (except the controls)
          to expand/collapse; cards are collapsed by default. */}
      <div
        style={styles.cardHeader}
        onClick={() => onToggleCollapse(index)}
        title={collapsed ? 'Expand this advisor' : 'Collapse this advisor'}
      >
        <button style={styles.chevron} tabIndex={-1}>
          {collapsed ? '▸' : '▾'}
        </button>
        <input
          type="checkbox"
          checked={entry.enabled !== false}
          onChange={event => onPatch(index, { enabled: event.target.checked })}
          onClick={event => event.stopPropagation()}
          title="Enable this advisor"
        />
        <input
          style={{ ...styles.input, width: 160 }}
          value={entry.name}
          placeholder="advisor name"
          onClick={event => event.stopPropagation()}
          onChange={event => onPatch(index, { name: event.target.value })}
        />
        {collapsed && (
          <span style={styles.hint}>
            {incomplete
              ? '— no model yet —'
              : `${entry.provider} / ${model?.name || entry.model}`}
          </span>
        )}
        <span style={styles.chip} title="Workspace patterns (empty = every session)">
          {workspaceCount === 0 ? 'all workspaces' : `${workspaceCount} workspace${workspaceCount > 1 ? 's' : ''}`}
        </span>
        <span style={styles.chip} title="Skills attached to this advisor">
          {skills.length} skills
        </span>
        {incomplete && (
          <span style={{ ...styles.hint, color: 'rgb(220,160,90)' }} title="Pick a provider and model before this advisor can run">
            ⚠ needs model
          </span>
        )}
        <span style={{ flex: 1 }} />
        <button
          style={styles.dangerButton}
          onClick={event => {
            event.stopPropagation()
            onRemove(index)
          }}
        >
          remove
        </button>
      </div>
      {!collapsed && (
        <>
          <div style={styles.row}>
            <select
              style={styles.select}
              value={entry.provider}
              onChange={event => {
                const nextGroup = catalog?.groups.find(item => item.id === event.target.value)
                onPatch(index, {
                  provider: event.target.value,
                  model: nextGroup?.models[0]?.id ?? '',
                  reasoningEffort: undefined
                })
              }}
            >
              <option value="">— provider —</option>
              {providerOptions}
            </select>
            <select
              style={styles.select}
              value={entry.model}
              onChange={event => onPatch(index, { model: event.target.value, reasoningEffort: undefined })}
            >
              <option value="">— model —</option>
              {modelOptions}
            </select>
            {efforts.length > 0 && (
              <select
                style={styles.select}
                value={entry.reasoningEffort ?? ''}
                onChange={event => onPatch(index, { reasoningEffort: event.target.value || undefined })}
                title="Reasoning effort"
              >
                <option value="">default effort</option>
                {effortOptions}
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
                    onPatch(index, { maxTurns: Math.min(10, Math.max(1, parsed)) })
                  }
                }}
              />
            </label>
          </div>
          <textarea
            style={styles.textarea}
            placeholder="Optional specialization, e.g. 'Focus on security: injection, secrets, unsafe deserialization.'"
            value={entry.instructions ?? ''}
            onChange={event => onPatch(index, { instructions: event.target.value })}
          />
          <div style={styles.row}>
            <span style={{ ...styles.hint, minWidth: 150 }}>Workspaces</span>
            <WorkspacesInput
              value={entry.workspaces ?? []}
              onCommit={next => onPatch(index, { workspaces: next })}
            />
          </div>
          <div style={styles.row}>
            <span style={{ ...styles.hint, minWidth: 150 }} />
            <span style={styles.hint}>
              Comma-separated substrings matched against the session's workspace path; this advisor only
              runs in matching sessions. Leave empty for every session. The Workspaces tab offers a
              per-workspace toggle matrix over the same field.
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={styles.row}>
              <span style={{ ...styles.hint, minWidth: 150 }}>Skills ({skills.length})</span>
              <select
                style={{ ...styles.select, maxWidth: 260 }}
                value={entry.skillMode === 'lazy' ? 'lazy' : 'inject'}
                title="inject = embed full skill bodies in the system prompt; lazy = id+description index plus a load_skill tool (saves tokens, costs one extra call per loaded skill)"
                onChange={event =>
                  onPatch(index, { skillMode: event.target.value === 'lazy' ? 'lazy' : 'inject' })
                }
              >
                <option value="inject">inject full bodies into prompt</option>
                <option value="lazy">lazy — load_skill on demand</option>
              </select>
              {preset && (
                <>
                  <span style={styles.hint}>preset: {preset.name}</span>
                  <button
                    style={styles.button}
                    title={`Restore the ${skills.length ? 'curated' : ''} skill list of ${preset.name}`}
                    onClick={() => onPatch(index, { skills: [...preset.skills] })}
                  >
                    reset to preset defaults
                  </button>
                </>
              )}
            </div>
            {skills.length > 0 && (
              <div style={{ ...styles.row, gap: 6 }}>
                {skills.map(skillId => {
                  const meta = SKILL_CATALOG.find(item => item.id === skillId)
                  return (
                    <span
                      key={skillId}
                      style={styles.chip}
                      title={meta?.description ?? 'Not packaged with this plugin version'}
                    >
                      {skillId}
                      <button
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: 'inherit',
                          cursor: 'pointer',
                          padding: 0,
                          font: 'inherit',
                          lineHeight: 1
                        }}
                        title="Remove this skill"
                        onClick={() => onPatch(index, { skills: skills.filter(id => id !== skillId) })}
                      >
                        ×
                      </button>
                    </span>
                  )
                })}
              </div>
            )}
            <select
              style={styles.select}
              value=""
              onChange={event => {
                if (event.target.value) {
                  onPatch(index, { skills: [...skills, event.target.value] })
                }
              }}
            >
              <option value="">+ add packaged skill…</option>
              {skillOptions}
            </select>
          </div>
        </>
      )}
    </div>
  )
})

/* ------------------------- workspaces × advisor matrix ------------------------ */
/*
 * Per-workspace activation matrix over the same `workspaces` field the card
 * editor writes (substring patterns matched against the session cwd). Rows
 * are the union the host reports (live session cwds + configured patterns)
 * plus patterns added in this dialog that no advisor holds yet. An advisor
 * with an empty list runs everywhere: its cells render indeterminate, and
 * checking one scopes it to that single workspace.
 */

interface WorkspacesMatrixProps {
  advisors: AdvisorEntryView[]
  knownWorkspaces: string[]
  onPatchAdvisor(index: number, patch: Partial<AdvisorEntryView>): void
}

function WorkspacesMatrix({ advisors, knownWorkspaces, onPatchAdvisor }: WorkspacesMatrixProps): React.ReactElement {
  const [pending, setPending] = useState<string[]>([])
  const [draft, setDraft] = useState('')

  // Rows: host-known workspaces plus locally added patterns not yet held by
  // any advisor (they persist once a checkbox writes them into one).
  const configured = new Set(advisors.flatMap(entry => entry.workspaces ?? []))
  const rows = [...new Set([...knownWorkspaces, ...pending])].filter(
    workspace => knownWorkspaces.includes(workspace) || !configured.has(workspace)
  )

  const toggle = (advisorIndex: number, workspace: string, checked: boolean): void => {
    const entry = advisors[advisorIndex]
    if (!entry) return
    const current = entry.workspaces ?? []
    if (checked) {
      if (current.includes(workspace)) return
      onPatchAdvisor(advisorIndex, { workspaces: [...current, workspace] })
    } else {
      onPatchAdvisor(advisorIndex, { workspaces: current.filter(item => item !== workspace) })
    }
  }

  const addPattern = (): void => {
    const pattern = draft.trim()
    if (!pattern) return
    setPending(current => (current.includes(pattern) || knownWorkspaces.includes(pattern) ? current : [...current, pattern]))
    setDraft('')
  }

  return (
    <div style={styles.card}>
      <div style={styles.row}>
        <strong>Workspaces</strong>
        <span style={styles.hint}>
          Which advisor runs in which workspace. A checked cell means the workspace pattern is in that
          advisor's list; an advisor with no patterns runs everywhere (indeterminate cells — checking one
          scopes it to that single workspace).
        </span>
      </div>
      {advisors.length === 0 ? (
        <span style={styles.hint}>No advisors yet — add one in the Advisors tab first.</span>
      ) : rows.length === 0 ? (
        <span style={styles.hint}>
          No workspaces seen yet. Start a session in a workspace and it appears here, or add a pattern below.
        </span>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', font: 'inherit' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '4px 8px', opacity: 0.7, fontWeight: 500 }}>Workspace</th>
                {advisors.map((entry, index) => (
                  <th key={index} style={{ textAlign: 'center', padding: '4px 8px', opacity: 0.7, fontWeight: 500 }}>
                    {entry.name || `advisor ${index + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(workspace => {
                const basename = workspace.split('/').filter(Boolean).pop() ?? workspace
                const seen = knownWorkspaces.includes(workspace)
                return (
                  <tr key={workspace}>
                    <td style={{ padding: '4px 8px', borderTop: '1px solid var(--dsh-border, rgba(128,128,128,0.15))' }}>
                      <span title={workspace} style={{ fontWeight: 600 }}>{basename}</span>
                      {basename !== workspace && (
                        <span style={{ ...styles.hint, marginLeft: 6 }}>{workspace}</span>
                      )}
                      {!seen && (
                        <span style={{ ...styles.hint, marginLeft: 6 }} title="Configured on an advisor but not open in any session right now">
                          (not seen yet)
                        </span>
                      )}
                    </td>
                    {advisors.map((entry, advisorIndex) => {
                      const list = entry.workspaces ?? []
                      const everywhere = list.length === 0
                      const checked = list.includes(workspace)
                      return (
                        <td
                          key={advisorIndex}
                          style={{ textAlign: 'center', padding: '4px 8px', borderTop: '1px solid var(--dsh-border, rgba(128,128,128,0.15))' }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            ref={element => {
                              if (element) element.indeterminate = everywhere && !checked
                            }}
                            title={
                              everywhere
                                ? 'Runs in every workspace — check to scope this advisor to only this workspace'
                                : checked
                                  ? 'Uncheck to remove this workspace from the advisor'
                                  : 'Check to add this workspace to the advisor'
                            }
                            onChange={event => toggle(advisorIndex, workspace, event.target.checked)}
                          />
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <div style={styles.row}>
        <input
          style={{ ...styles.input, flex: 1, minWidth: 220 }}
          placeholder="Add a workspace pattern (path or substring)…"
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') addPattern()
          }}
        />
        <button style={styles.button} onClick={addPattern}>
          Add row
        </button>
        <span style={styles.hint}>Then tick the advisors that should run there.</span>
      </div>
    </div>
  )
}

/* --------------------------------- event feed -------------------------------- */

const EVENT_KIND_COLORS: Record<string, string> = {
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

function formatEventTime(time: number): string {
  const date = new Date(time)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function EventFeed(props: { events: EventEntryView[] }): React.ReactElement {
  if (props.events.length === 0) {
    return <span style={styles.hint}>No advisor activity yet this server run.</span>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflowY: 'auto' }}>
      <strong style={{ marginTop: 6 }}>Activity</strong>
      {props.events.map((event, index) => (
        <div key={`${event.time}-${index}`} style={{ ...styles.row, gap: 8 }}>
          <span style={{ ...styles.hint, fontVariantNumeric: 'tabular-nums' }}>{formatEventTime(event.time)}</span>
          <span
            style={{
              ...styles.chip,
              borderColor: EVENT_KIND_COLORS[event.kind] ?? 'var(--dsh-border, rgba(128,128,128,0.25))',
              color: EVENT_KIND_COLORS[event.kind] ?? 'inherit'
            }}
          >
            {event.kind}
          </span>
          {event.advisor && <span style={{ fontWeight: 600 }}>{event.advisor}</span>}
          {event.sessionId && (
            <span style={styles.hint} title={event.sessionId}>
              {event.sessionId.slice(0, 8)}
            </span>
          )}
          {event.detail && <span style={styles.hint}>{event.detail}</span>}
        </div>
      ))}
    </div>
  )
}

/* --------------------------------- component -------------------------------- */

/**
 * Expansion state is keyed by roster index; when a card is removed, every
 * later index shifts down by one. Rebuild the set so the same *cards* stay
 * expanded — drop the removed index, decrement everything above it.
 * Exported for unit tests (pure; no React).
 */
export function shiftExpandedAfterRemove(expanded: Set<number>, removedIndex: number): Set<number> {
  const next = new Set<number>()
  for (const index of expanded) {
    if (index < removedIndex) next.add(index)
    else if (index > removedIndex) next.add(index - 1)
  }
  return next
}

export function createSettingsSection(ctx: ClientCtx): React.ComponentType<{ close?: () => void }> {
  return function OmpAdvisorSettingsSection() {
    // Server truth (snapshot poll + settled writes) and an optimistic draft
    // laid over it while the user is editing. Rendering reads the draft
    // first, so every control reflects a change the instant it happens.
    //
    // The host normalizes settings on write (trims names/instructions, drops
    // entries without a name yet), so folding a response back mid-typing
    // would yank characters out of focused inputs. Therefore:
    //  - text edits debounce their host write (coalesced per pause),
    //  - the draft stays up until the write queue drains AND a short grace
    //    period passes with no new edit, and only then folds settled state,
    //  - the 5s poll refreshes live session status but never touches the
    //    settings section while a draft is up.
    const [view, setView] = useState<SnapshotView | null>(null)
    const [draft, setDraft] = useState<SettingsView | null>(null)
    const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
    const [writeError, setWriteError] = useState<string | null>(null)
    const [catalog, setCatalog] = useState<ModelCatalog | null>(null)
    const [catalogError, setCatalogError] = useState<string | null>(null)
    // Inner tab (market-style sub-tab bar). Component-local, default General.
    const [tab, setTab] = useState<'general' | 'advisors' | 'workspaces' | 'monitor'>('general')
    // Expanded advisor cards (collapsed by default); per dialog-open lifetime.
    const [expanded, setExpanded] = useState<Set<number>>(() => new Set())

    const viewRef = useRef<SnapshotView | null>(null)
    viewRef.current = view
    const draftRef = useRef<SettingsView | null>(null)
    draftRef.current = draft
    // Serialized write queue: patches reach the host in edit order.
    const queueRef = useRef<Promise<unknown>>(Promise.resolve())
    const pendingRef = useRef(0)
    const settledSettingsRef = useRef<SettingsView | null>(null)
    // Debounce (text edits) and grace (draft fold) timers.
    const textTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
      return () => {
        if (textTimerRef.current !== null) clearTimeout(textTimerRef.current)
        if (graceTimerRef.current !== null) clearTimeout(graceTimerRef.current)
      }
    }, [])

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
            if (cancelled) return
            setPhase('ready')
            if (pendingRef.current > 0 || draftRef.current !== null) {
              // Editing: keep live data fresh (status, monitor fields),
              // leave the settings form alone.
              setView(current =>
                current
                  ? {
                      ...current,
                      sessions: value.sessions,
                      knownWorkspaces: value.knownWorkspaces,
                      recentEvents: value.recentEvents
                    }
                  : value
              )
              return
            }
            settledSettingsRef.current = value.settings
            setView(value)
          })
          .catch(() => {
            // Keep the last good view; only flip to error before first success.
            if (!cancelled) setPhase(current => (current === 'ready' ? current : 'error'))
          })
      }
      poll()
      const timer = setInterval(poll, 5000)
      return () => {
        cancelled = true
        clearInterval(timer)
      }
    }, [])

    const enqueueWrite = useCallback((field: string, next: unknown) => {
      pendingRef.current += 1
      queueRef.current = queueRef.current
        .then(() => ctx.connection.rpc.call('/dsh-omp-advisor', 'update', { patch: { [field]: next } }))
        .then(result => {
          const updated = unwrapRpcResult<{ settings: SettingsView }>(result, 'advisor settings update')
          settledSettingsRef.current = updated.settings
        })
        .catch((err: unknown) => {
          setWriteError(String(err instanceof Error ? err.message : err))
        })
        .finally(() => {
          pendingRef.current -= 1
          if (pendingRef.current !== 0) return
          // Queue drained: fold settled state after a grace period so a user
          // who keeps typing is never interrupted by a normalization fold.
          if (graceTimerRef.current !== null) clearTimeout(graceTimerRef.current)
          graceTimerRef.current = setTimeout(() => {
            graceTimerRef.current = null
            if (pendingRef.current > 0) return
            const settled = settledSettingsRef.current
            if (settled) setView(current => (current ? { ...current, settings: settled } : current))
            setDraft(null)
          }, 1500)
        })
    }, [])

    const write = useCallback(
      (field: string, next: unknown, options?: { text?: boolean }) => {
        setWriteError(null)
        // Any edit cancels a pending normalization fold.
        if (graceTimerRef.current !== null) {
          clearTimeout(graceTimerRef.current)
          graceTimerRef.current = null
        }
        // 1. Optimistic apply — the UI reflects the edit this frame.
        setDraft(current => {
          const base = current ?? settledSettingsRef.current ?? viewRef.current?.settings
          if (!base) return current
          return { ...base, [field]: next }
        })
        // 2. Host write: debounced for free-text fields (one write per typing
        //    pause, carrying the latest value), immediate for discrete controls.
        if (options?.text) {
          if (textTimerRef.current !== null) clearTimeout(textTimerRef.current)
          textTimerRef.current = setTimeout(() => {
            textTimerRef.current = null
            enqueueWrite(field, next)
          }, 350)
          return
        }
        enqueueWrite(field, next)
      },
      [enqueueWrite]
    )

    const value = draft ?? view?.settings
    const advisors = useMemo<AdvisorEntryView[]>(() => value?.advisors ?? [], [value])

    // Stable callbacks for the memoized AdvisorCard: read the current roster
    // through a ref instead of closing over it, so their identity never
    // changes and sibling cards skip re-rendering while one card is edited.
    const advisorsRef = useRef(advisors)
    advisorsRef.current = advisors

    const updateAdvisor = useCallback(
      (index: number, patch: Partial<AdvisorEntryView>) => {
        const next = advisorsRef.current.map((entry, i) =>
          i === index ? { ...entry, ...patch } : entry
        )
        const keys = Object.keys(patch)
        const textOnly = keys.every(key => key === 'name' || key === 'instructions')
        write('advisors', next, textOnly ? { text: true } : undefined)
      },
      [write]
    )

    const removeAdvisor = useCallback(
      (index: number) => {
        write(
          'advisors',
          advisorsRef.current.filter((_, i) => i !== index)
        )
        // Keep expansion attached to the same cards after the index shift.
        setExpanded(current => shiftExpandedAfterRemove(current, index))
      },
      [write]
    )

    const toggleCollapse = useCallback((index: number) => {
      setExpanded(current => {
        const next = new Set(current)
        if (next.has(index)) next.delete(index)
        else next.add(index)
        return next
      })
    }, [])

    const expandIndex = (index: number): void => {
      setExpanded(current => {
        const next = new Set(current)
        next.add(index)
        return next
      })
    }

    const addAdvisor = useCallback(() => {
      const firstGroup = catalog?.groups.find(group => group.models.length > 0)
      const firstModel = firstGroup?.models[0]
      const baseNames = new Set(advisors.map(entry => entry.name))
      let name = 'advisor'
      let suffix = 2
      while (baseNames.has(name)) name = `advisor-${suffix++}`
      expandIndex(advisors.length)
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

    const applyPreset = useCallback(
      (presetId: string) => {
        const preset = findPreset(presetId)
        if (!preset) return
        const firstGroup = catalog?.groups.find(group => group.models.length > 0)
        const firstModel = firstGroup?.models[0]
        const baseNames = new Set(advisors.map(entry => entry.name))
        let name = preset.name
        let suffix = 2
        while (baseNames.has(name)) name = `${preset.name} ${suffix++}`
        expandIndex(advisors.length)
        write('advisors', [
          ...advisors,
          {
            name,
            provider: firstGroup?.id ?? '',
            model: firstModel?.id ?? '',
            maxTurns: 4,
            instructions: preset.soul,
            skills: [...preset.skills],
            preset: preset.id,
            enabled: true
          }
        ])
      },
      [advisors, catalog, write]
    )

    if (!value) {
      if (phase === 'loading') {
        return <div style={styles.root}>Loading advisor settings…</div>
      }
      return (
        <div style={styles.root}>
          <div style={styles.card}>
            <strong>Advisor settings unavailable</strong>
            <span style={styles.hint}>
              The dsh-omp-advisor host service is not reachable. Restart DSH after installing the plugin.
            </span>
          </div>
        </div>
      )
    }

    const severities = value.interruptSeverities ?? ['concern', 'blocker']

    const tabs = [
      { id: 'general' as const, label: 'General' },
      { id: 'advisors' as const, label: `Advisors (${advisors.length})` },
      { id: 'workspaces' as const, label: 'Workspaces' },
      { id: 'monitor' as const, label: 'Monitor' }
    ]

    return (
      <div style={styles.root}>
        {writeError && <div style={styles.hint}>Settings write failed: {writeError}</div>}
        <div style={styles.tabBar}>
          {tabs.map(item => (
            <button
              key={item.id}
              style={{ ...styles.tabButton, ...(tab === item.id ? styles.tabButtonActive : {}) }}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {tab === 'general' && (
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
            {value.reviewTrigger === 'step' ? (
              <span style={{ ...styles.hint, color: 'rgb(220,160,90)' }}>
                Step mode fires a review on every tool step — heavy on rate-limited or metered providers. Prefer
                turn mode unless you need mid-turn advice.
              </span>
            ) : null}
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
          <div style={styles.row}>
            <span style={styles.label}>Coalesce advice (ms)</span>
            <input
              type="number"
              min={0}
              max={10000}
              step={100}
              style={{ ...styles.input, width: 90 }}
              value={value.adviceCoalesceMs ?? 0}
              onChange={event => {
                const parsed = Number.parseInt(event.target.value, 10)
                if (Number.isFinite(parsed)) {
                  write('adviceCoalesceMs', Math.min(10000, Math.max(0, parsed)))
                }
              }}
            />
            <span style={styles.hint}>
              0 = deliver each note immediately. Above 0, notes from all advisors are batched within the window
              into one message per channel; an interrupting severity flushes the batch at once.
            </span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Auto-retry failures</span>
            <label>
              <input
                type="checkbox"
                checked={value.autoRetry !== false}
                onChange={event => write('autoRetry', event.target.checked)}
              />{' '}
              retry failed work automatically
            </label>
            <span style={{ ...styles.hint, opacity: 0.75 }}>after</span>
            <input
              type="number"
              min={1000}
              max={300000}
              step={500}
              style={{ ...styles.input, width: 90 }}
              value={value.autoRetryDelayMs ?? 5000}
              onChange={event => {
                const parsed = Number.parseInt(event.target.value, 10)
                if (Number.isFinite(parsed)) {
                  write('autoRetryDelayMs', Math.min(300000, Math.max(1000, parsed)))
                }
              }}
            />
            <span style={{ ...styles.hint, opacity: 0.75 }}>ms, up to</span>
            <input
              type="number"
              min={0}
              max={999}
              step={1}
              style={{ ...styles.input, width: 70 }}
              value={value.autoRetryMax ?? 3}
              onChange={event => {
                const parsed = Number.parseInt(event.target.value, 10)
                if (Number.isFinite(parsed)) {
                  write('autoRetryMax', Math.min(999, Math.max(0, parsed)))
                }
              }}
            />
            <span style={{ ...styles.hint, opacity: 0.75 }}>attempts (0 = unlimited)</span>
          </div>
          <div style={styles.row}>
            <span style={styles.label} />
            <span style={styles.hint}>
              Failed advisor reviews re-run after the delay; a failed primary-model turn receives an automatic
              “continue” message. User aborts and permanent errors (unknown model/provider) never retry, even
              when the cap is unlimited.
            </span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Blocker intervention</span>
            <label>
              <input
                type="checkbox"
                checked={value.interveneOnBlocker === true}
                onChange={event => write('interveneOnBlocker', event.target.checked)}
              />{' '}
              cancel the running step when an advisor raises a blocker
            </label>
          </div>
          <div style={styles.row}>
            <span style={styles.label} />
            <span style={{ ...styles.hint, color: 'rgb(220,160,90)' }}>
              Escalation, off by default. With review trigger “step”, a blocker raised while the primary agent
              is running aborts the step's not-yet-started tool calls and wakes the agent with the advisory.
              Already-running tool calls are never killed; DSH offers no pre-call veto, so fast tools may finish
              before the advisor reacts. Advice stays advice unless you opt in.
            </span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Restore points</span>
            <label>
              <input
                type="checkbox"
                checked={value.restorePoints === true}
                onChange={event => write('restorePoints', event.target.checked)}
              />{' '}
              snapshot the workspace with git so advisors can recommend rewinds
            </label>
          </div>
          <div style={styles.row}>
            <span style={styles.label} />
            <span style={styles.hint}>
              Side-effect-free git objects under refs/dsh-omp-advisor/** — your index, HEAD, branch, and files
              are never touched. Captured at turn boundaries; keep{' '}
              <input
                type="number"
                min={1}
                max={100}
                step={1}
                style={{ ...styles.input, width: 60 }}
                value={value.restorePointKeep ?? 20}
                onChange={event => {
                  const parsed = Number.parseInt(event.target.value, 10)
                  if (Number.isFinite(parsed)) {
                    write('restorePointKeep', Math.min(100, Math.max(1, parsed)))
                  }
                }}
              />{' '}
              per session.{' '}
              <label>
                <input
                  type="checkbox"
                  checked={value.restorePointOnMutation !== false}
                  onChange={event => write('restorePointOnMutation', event.target.checked)}
                />{' '}
                also snapshot before mutating tools
              </label>
            </span>
          </div>
          <div style={styles.row}>
            <span style={styles.label} />
            <span style={{ ...styles.hint, opacity: 0.75 }}>
              Rewinds are advice: the advisor names the restore point and which steps were destructive vs
              progress; the main model runs the restore itself. Files created after a point are kept, never
              deleted. Non-git workspaces are skipped.
            </span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Completion gate</span>
            <label>
              <input
                type="checkbox"
                checked={value.completionGate !== false}
                onChange={event => write('completionGate', event.target.checked)}
              />{' '}
              verify work is actually done before the agent claims completion
            </label>
          </div>
          <div style={styles.row}>
            <span style={styles.label} />
            <span style={{ ...styles.hint, opacity: 0.75 }}>
              On by default (prompt-only). If the ask is not fully implemented, the advisor instructs the agent
              to report honestly what was and wasn't done and ask you; once complete — or once you accept the
              compromise — it reminds the agent to commit the accepted state to its working branch.
            </span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Skip tiny deltas (chars)</span>
            <input
              type="number"
              min={0}
              max={100000}
              step={50}
              style={{ ...styles.input, width: 90 }}
              value={value.minDeltaChars ?? 0}
              onChange={event => {
                const parsed = Number.parseInt(event.target.value, 10)
                if (Number.isFinite(parsed)) {
                  write('minDeltaChars', Math.min(100000, Math.max(0, parsed)))
                }
              }}
            />
            <span style={styles.hint}>
              0 = review everything. Above 0, transcript updates smaller than this are skipped (not replayed
              later) — cuts advisor calls on chatty sessions.
            </span>
          </div>
        </div>
        )}

        {tab === 'advisors' && (
        <div style={styles.card}>
          <div style={styles.row}>
            <strong>Advisors</strong>
            <span style={styles.hint}>Each advisor reviews transcript updates with its own model and read-only tools. Cards are collapsed by default — click a header to expand.</span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Add from preset</span>
            <select
              style={styles.select}
              value=""
              onChange={event => {
                if (event.target.value) applyPreset(event.target.value)
              }}
            >
              <option value="">— choose a preset advisor —</option>
              {PRESET_OPTIONS}
            </select>
            <span style={styles.hint}>
              Presets create a ready-made advisor with an expanded persona and 10 curated skills.
            </span>
          </div>

          {catalogError && (
            <div style={styles.hint}>Model list unavailable: {catalogError}</div>
          )}

          {advisors.map((entry, index) => (
            <AdvisorCard
              key={index}
              entry={entry}
              index={index}
              catalog={catalog}
              collapsed={!expanded.has(index)}
              onToggleCollapse={toggleCollapse}
              onPatch={updateAdvisor}
              onRemove={removeAdvisor}
            />
          ))}

          <div>
            <button style={styles.button} onClick={addAdvisor}>
              + Add advisor
            </button>
          </div>
        </div>
        )}

        {tab === 'workspaces' && (
          <WorkspacesMatrix
            advisors={advisors}
            knownWorkspaces={view?.knownWorkspaces ?? []}
            onPatchAdvisor={updateAdvisor}
          />
        )}

        {tab === 'monitor' && (
        <div style={styles.card}>
          <strong>Live status</strong>
          {(view?.sessions ?? []).length === 0 ? (
            <span style={styles.hint}>
              {value.enabled
                ? 'No sessions with attached advisors yet. Start a session and advisors will attach.'
                : 'Advisors are disabled.'}
            </span>
          ) : (
            (view?.sessions ?? []).map(session => (
              <div key={session.sessionId} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={styles.hint}>
                  {session.title ? (
                    <strong style={{ color: 'inherit' }}>{session.title}</strong>
                  ) : (
                    `session ${session.sessionId}`
                  )}
                  {session.cwd ? ` · ${session.cwd}` : ''}
                  {typeof session.restorePoints === 'number' ? ` · ${session.restorePoints} restore points` : ''}
                </span>
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
                {session.advisors
                  .filter(advisor => advisor.lastError)
                  .map(advisor => (
                    <span
                      key={`${advisor.name}-error`}
                      style={{ ...styles.hint, color: '#dc7070', whiteSpace: 'pre-wrap' }}
                    >
                      ⚠ {advisor.name}: {advisor.lastError}
                    </span>
                  ))}
              </div>
            ))
          )}
          <EventFeed events={view?.recentEvents ?? []} />
        </div>
        )}

        <div style={styles.hint}>
          Advice semantics ported from oh-my-pi (can1357/oh-my-pi, MIT). Advisors investigate with read-only
          tools and deliver notes as &lt;advisory guidance="weigh, don't blindly obey"&gt; — the primary agent
          decides what to do with them.
        </div>
      </div>
    )
  }
}
