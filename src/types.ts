/**
 * Shared types for dsh-omp-advisor, plus minimal structural declarations of
 * the DSH runtime seams the plugin touches. The real implementations are
 * supplied by the DSH runtime (@deepseek-ai/* packages); declaring narrow
 * local shapes keeps the plugin buildable without those packages installed.
 */

/* ---------------------------------- advice --------------------------------- */

/** How strongly the advisor weighs a note. Omitted severity is a plain nit. */
export type AdvisorSeverity = 'nit' | 'concern' | 'blocker'

/** One advice note produced by an advisor's `advise` tool call. */
export interface AdvisorNote {
  note: string
  severity?: AdvisorSeverity
  /** Which configured advisor produced this note. */
  advisor?: string
  /**
   * Structured extras validated by the advisor loop (rewind recommendation,
   * completion-gate acceptance + commit hint). Rendered into the advisory.
   */
  meta?: {
    rewindTo?: { id: string; sha: string; turn?: number }
    acceptance?: 'completed' | 'compromise-accepted'
    commitHint?: string
  }
}

/** How one advisor note reaches the primary agent. */
export type AdvisorDeliveryChannel = 'inject' | 'steer'

/* --------------------------------- settings -------------------------------- */

/** One advisor entry in the `dsh-omp-advisor` settings namespace. */
export interface AdvisorEntry {
  name: string
  /** DSH provider route id (from the host model list). */
  provider: string
  /** Provider-owned model id under that route. */
  model: string
  /** Adapter-owned reasoning effort, optional. */
  reasoningEffort?: string
  /** Max advisor tool-loop turns per review (>= 1). */
  maxTurns: number
  /** Specialization appended to the shared advisor baseline prompt. */
  instructions?: string
  /** Packaged skill ids (skills/<id>/SKILL.md) injected into this advisor's context. */
  skills?: string[]
  /**
   * How skills reach the advisor: 'inject' embeds full skill bodies in the
   * system prompt (default); 'lazy' embeds only id+description and grants a
   * `load_skill` tool so bodies are fetched on demand.
   */
  skillMode?: 'inject' | 'lazy'
  /** Built-in preset id this advisor was created from (enables "reset to preset skills"). */
  preset?: string
  /**
   * Workspace scoping: substring patterns matched against the session cwd.
   * Empty/omitted = the advisor runs in every session.
   */
  workspaces?: string[]
  /** Per-advisor on/off toggle (default true). */
  enabled?: boolean
}

/** Resolved `dsh-omp-advisor` settings namespace value. */
export interface AdvisorSettings {
  enabled: boolean
  reviewTrigger: 'step' | 'turn'
  interruptSeverities: AdvisorSeverity[]
  /**
   * Advice coalesce window in ms. 0 = deliver each note individually;
   * >0 = batch notes from all advisors into one message per window
   * (interrupting severities flush the batch immediately).
   */
  adviceCoalesceMs: number
  /**
   * Auto-retry failed work. When on: failed advisor reviews re-run after
   * `autoRetryDelayMs` (up to `autoRetryMax` attempts per review), and a
   * failed primary-model turn receives an automatic "continue" followup
   * message after the same delay (aborts and permanent errors never retry).
   */
  autoRetry: boolean
  /** Delay before an auto-retry fires (ms). */
  autoRetryDelayMs: number
  /** Max auto-retry attempts per failed review / failure episode. 0 = unlimited. */
  autoRetryMax: number
  /**
   * Escalation (off by default): when an advisor raises a blocker while the
   * primary agent is running, cancel the running step (undispatched tool
   * calls abort) and wake the agent with the advisory as a followup.
   */
  interveneOnBlocker: boolean
  /**
   * Git restore points: snapshot the workspace (side-effect-free git
   * objects under refs/dsh-omp-advisor/**) at turn boundaries and, with
   * `restorePointOnMutation`, before mutating tools. Advisors can list/diff
   * points and recommend rewinds; the primary model executes restores.
   */
  restorePoints: boolean
  /** How many restore points to keep per session (oldest pruned). */
  restorePointKeep: number
  /** Also snapshot before mutating tools (fs intents + configured tools). */
  restorePointOnMutation: boolean
  /**
   * Completion gate: prompt protocol making the advisor verify the user's
   * ask is actually implemented before the agent claims completion, demand
   * honest done/not-done reporting otherwise, and remind the agent to
   * commit the accepted state to its working branch.
   */
  completionGate: boolean
  /**
   * Skip reviews whose rendered delta is smaller than this many characters
   * (0 = review everything). Skipped deltas are not replayed later.
   */
  minDeltaChars: number
  advisors: AdvisorEntry[]
}

/* ------------------------------ advisor status ----------------------------- */

export type AdvisorRuntimeStatus =
  | 'running'
  | 'paused'
  | 'quota_exhausted'
  | 'error'
  | 'halted'
  | 'no_model'

/** Per-advisor live state surfaced through the RPC snapshot. */
export interface AdvisorStatusView {
  name: string
  status: AdvisorRuntimeStatus
  backlog: number
  reviewsCompleted: number
  adviceDelivered: number
  lastError?: string
}

/** Per-session snapshot surfaced through the RPC channel. */
export interface SessionAdvisorSnapshot {
  sessionId: string
  active: boolean
  advisors: AdvisorStatusView[]
  recentNotes: AdvisorNote[]
  /** Restore points recorded for this session (when restore points are on). */
  restorePoints?: number
}

/**
 * One entry in the service-wide activity ring (monitor surfaces). Bounded,
 * in-memory only — monitoring, not audit. `detail` is plugin-authored text
 * (never raw model output) and stays clipped.
 */
export interface AdvisorEventEntry {
  time: number
  kind:
    | 'review-done'
    | 'review-failed'
    | 'retry'
    | 'quota'
    | 'halted'
    | 'backlog-dropped'
    | 'advice'
    | 'intervention'
    | 'continue-sent'
    | 'restore-point'
    | 'attach'
    | 'detach'
    | (string & {})
  advisor?: string
  sessionId?: string
  detail?: string
}

/* --------------------------- DSH runtime seams ----------------------------- */
/* Narrow structural views of the cordis/DSH objects the plugin consumes. */

/** One durable session-log event (subset the advisor reads). */
export interface SessionEvent {
  type: string
  data?: any
  [key: string]: unknown
}

export interface SessionLike {
  id: string | { toString(): string }
  events: SessionEvent[]
  header?: { cwd?: string; agentPreset?: string; parentSession?: string }
  meta?: { cwd?: string }
}

export interface AgentLike {
  id: string | { toString(): string }
  status: string
  session: SessionLike
  inject(message: unknown): void
  steer(message: unknown): void
  followup(message: unknown): void
  /**
   * Abort the running step (undispatched parallel tool calls are dropped,
   * started ones commit). Present on live DSH agent loops; optional here so
   * the plugin degrades to advice-only on hosts without it.
   */
  cancel?(cause: unknown, options?: { keepInbox?: boolean }): void
}

/** `ctx.llm.stream` chunk (dsh-llm StreamChunk subset the loop consumes). */
export type LlmStreamChunk =
  | { type: 'block-start'; index: number; blockType: string }
  | { type: 'text-delta'; index: number; text: string }
  | { type: 'reasoning-delta'; index: number; text: string }
  | { type: 'tool-call-delta'; index: number; id: string; name?: string; argumentsDelta: string }
  | { type: 'block-end'; index: number; block: LlmContentBlock }
  | { type: 'usage'; usage: unknown }
  | { type: 'finish'; reason: { kind: string; failure?: { message: string; code: string } } }

export type LlmContentBlock =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text: string }
  | { type: 'tool-call'; id: string; name: string; arguments: string }
  | { type: 'tool-result'; toolCallId: string; content: LlmContentBlock[]; isError?: boolean }

/** One model call request as accepted by `ctx.llm.stream`. */
export interface LlmGenerateOptions {
  provider: string
  model: string
  reasoningEffort?: string
  messages: unknown[]
  system?: string
  tools?: { name: string; description: string; parameters: Record<string, unknown> }[]
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
}

export interface LlmLike {
  stream(options: LlmGenerateOptions): AsyncIterable<LlmStreamChunk>
}

/** Minimal cordis context surface used by the plugin. */
export interface CordisContextLike {
  llm: LlmLike
  settings: {
    register<T>(ns: string, schema: unknown, options?: unknown): SettingsScopeLike<T>
  }
  agents: { get(sessionId: string): AgentLike | undefined }
  connection?: {
    rpc: {
      handle(
        channel: string,
        handler: (endpoint: string, payload: unknown, signal: AbortSignal) => Promise<unknown>,
        options: { authority: 'trusted-host' | 'loopback' }
      ): () => void
    }
  }
  logger?: {
    info?(...args: unknown[]): void
    warn?(...args: unknown[]): void
    debug?(...args: unknown[]): void
  }
  on(event: string, listener: (...args: any[]) => unknown, options?: { prepend?: boolean }): () => void
  effect(factory: () => unknown, label?: string): void
  get?(name: string): unknown
}

export interface SettingsScopeLike<T> {
  get(): T
  watch(callback: (next: T, prev: T) => void | Promise<void>): () => void
  update(patch: object): Promise<void>
  replace(section: object): Promise<void>
}
