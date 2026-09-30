/**
 * Per-session advisor runtime: owns one advisor loop per configured advisor,
 * feeds transcript deltas from the durable session log, contains failures,
 * and routes accepted advice into the primary agent.
 *
 * Ported containment semantics (oh-my-pi, MIT): serialized drain, 3-failure
 * backlog drop, permanent-error halt, quota cooldown pause. DSH-safe
 * deviation: the primary agent is never blocked on an advisor.
 */
import { AdvisorLoop } from './advisor-loop'
import { formatAdvisorBatchContent, isInterruptingSeverity, resolveDeliveryChannel } from './delivery'
import { PLUGIN_NAME, renderDelta } from './delta'
import type {
  AdvisorEntry,
  AdvisorNote,
  AdvisorRuntimeStatus,
  AdvisorSeverity,
  AdvisorSettings,
  AdvisorStatusView,
  AgentLike,
  LlmLike,
  SessionEvent,
  ToolGateBlock,
  ToolGateSettings
} from './types'

/** Consecutive failures tolerated before the backlog is dropped. */
const MAX_CONSECUTIVE_FAILURES = 3
/** Cooldown after a quota/rate-limit failure before the advisor retries. */
const QUOTA_COOLDOWN_MS = 5 * 60_000
/** Recent delivered notes retained for the RPC snapshot. */
const RECENT_NOTES_LIMIT = 20

const QUOTA_CODES = new Set(['RATE_LIMIT', 'QUOTA', 'QUOTA_EXHAUSTED', 'RATE_LIMITED', 'TOO_MANY_REQUESTS'])
/**
 * How many sub-threshold deltas may be withheld before a review is forced.
 * Bounds how far coverage can lag when a workload produces only small deltas —
 * without it, a long run of tiny edits would be deferred forever and reviewed
 * never, which is the failure the threshold was meant to avoid.
 */
const DEFERRED_SKIP_LIMIT = 3

function isQuotaFailure(error: unknown): boolean {
  const message = String(error instanceof Error ? error.message : error)
  if (/rate.?limit|quota|429|too many requests/i.test(message)) return true
  const code = (error as { code?: unknown })?.code
  return typeof code === 'string' && QUOTA_CODES.has(code.toUpperCase())
}

function isPermanentFailure(error: unknown): boolean {
  return /model not (found|supported)|no adapter|unknown provider|invalid (provider|model)|does not exist/i.test(
    String(error instanceof Error ? error.message : error)
  )
}

/**
 * True when the review failed because the advisor's accumulated context exceeds
 * the model's window. Retrying the same bloated history can never succeed, so
 * this is handled by resetting the conversation (shrink) rather than by the
 * ordinary auto-retry path — which would otherwise loop forever on it.
 */
function isContextOverflow(error: unknown): boolean {
  const message = String(error instanceof Error ? error.message : error)
  return /CONTEXT_WINDOW_EXCEEDED|context.?length|longer than the model|maximum context length|context_length_exceeded|prompt is too long|input.{0,40}too long/i.test(
    message
  )
}

interface AdvisorSlot {
  entry: AdvisorEntry
  loop: AdvisorLoop
  cursor: number
  updateIndex: number
  status: AdvisorRuntimeStatus
  backlog: number
  reviewsCompleted: number
  adviceDelivered: number
  consecutiveFailures: number
  lastError?: string
  /** Why the slot halted (drives the Monitor's recovery hint + Resume action). */
  haltReason?: 'context-overflow' | 'permanent'
  quotaUntil?: number
  draining: boolean
  queued: ReviewQueueItem[]
  /**
   * Rendered deltas withheld by `minDeltaChars`, held to be prepended to the
   * next review rather than discarded. The cursor has already advanced past
   * them, so this buffer is the only copy.
   */
  deferredText?: string
  /** Consecutive deferrals; bounds how long review coverage can lag. */
  deferredSkips: number
}

/** One queued review pass. Retries carry the pre-rendered delta text. */
interface ReviewQueueItem {
  inProgress: boolean
  /** Set on auto-retry: re-review this exact delta instead of rendering a new one. */
  retryText?: string
  /** Auto-retry attempt number (0 = first try). */
  attempt: number
  /** Set after a context-overflow reset: a second overflow halts instead of looping. */
  overflowRecovered?: boolean
}

/** Shape of the `turn/end` session event data the runtime watches for failures. */
interface TurnEndReason {
  kind?: string
  error?: { message?: string; code?: string }
  [key: string]: unknown
}

export interface SessionRuntimeHost {
  sessionId: string
  /** Live agent handle for the session, when one is attached. */
  getAgent(): AgentLike | undefined
  /** Current durable event list of the session. */
  getEvents(): SessionEvent[]
  /** Workspace cwd for advisor tools. */
  cwd: string
  llm: LlmLike
  /** Message factory bound to the DSH runtime (createUserMessage). */
  makeUserMessage(text: string): unknown
  log?(message: string, meta?: Record<string, unknown>): void
  /** Activity-ring hook (monitor surfaces); sessionId is added by the service. */
  recordEvent?(kind: string, advisor?: string, detail?: string): void
  /**
   * Recall long-term memory for one review (v0.7.0). Returns the rendered
   * `<recalled-memory>` block or '' — best-effort, never throws into reviews.
   */
  recallMemory?(advisorName: string, engineIds: string[] | undefined, deltaText: string): Promise<string>
  /** Route one durable lesson emitted by an advisor through the write gate. */
  onMemoryLesson?(advisorName: string, lesson: { text: string; tags: string[] }): void
}

export class SessionAdvisorRuntime {
  private slots = new Map<string, AdvisorSlot>()
  private disposed = false
  private recentNotes: AdvisorNote[] = []
  private interruptSeverities: AdvisorSeverity[]
  /** Advice coalesce window (ms); 0 delivers each note individually. */
  private coalesceMs = 0
  /** Notes buffered inside the coalesce window, across all advisors. */
  private pendingNotes: AdvisorNote[] = []
  private coalesceTimer?: ReturnType<typeof setTimeout>
  /** Auto-retry of failed advisor reviews / failed primary turns. */
  private autoRetry = true
  private autoRetryDelayMs = 5000
  private autoRetryMax = 3
  /** Escalation: blocker raised mid-run cancels the step (opt-in). */
  private interveneOnBlocker = false
  /** Tool-call gate policy (v0.9.0); the service evaluates it per tool call. */
  private toolGate: ToolGateSettings = {
    enabled: false,
    mode: 'deny',
    tools: [],
    severities: ['blocker'],
    maxDenials: 2,
    note: ''
  }
  /**
   * The finding currently arming the tool gate. Armed by `deliver` when an
   * advisor reports a gating severity, cleared by the user (RPC) or when the
   * session's runtimes are rebuilt away.
   */
  private gate?: { advisor: string; severity: AdvisorSeverity; note: string; denials: number }
  /** Skip reviews whose rendered delta is smaller than this (chars; 0 = off). */
  private minDeltaChars = 0
  /** Primary-model failure episode state (resets on a completed turn). */
  private continueAttempts = 0
  private continueTimer?: ReturnType<typeof setTimeout>
  /** Pending advisor retry timers, cleared on dispose. */
  private retryTimers = new Set<ReturnType<typeof setTimeout>>()

  constructor(
    private readonly host: SessionRuntimeHost,
    settings: AdvisorSettings,
    private readonly createUserMessage: (text: string) => unknown
  ) {
    this.interruptSeverities = [...settings.interruptSeverities]
    this.rebuild(settings)
  }

  /** Rebuild advisor slots from settings, preserving cursors where the advisor survives. */
  rebuild(settings: AdvisorSettings): void {
    if (this.disposed) return
    this.interruptSeverities = [...settings.interruptSeverities]
    this.coalesceMs = Math.max(0, settings.adviceCoalesceMs || 0)
    this.autoRetry = settings.autoRetry !== false
    this.autoRetryDelayMs = Math.min(300000, Math.max(1000, Math.round(settings.autoRetryDelayMs || 5000)))
    const maxRaw = Number.isFinite(settings.autoRetryMax) ? settings.autoRetryMax : 3
    this.autoRetryMax = Math.min(999, Math.max(0, Math.round(maxRaw)))
    this.interveneOnBlocker = settings.interveneOnBlocker === true
    this.toolGate = settings.toolGate ?? this.toolGate
    this.minDeltaChars = Math.min(100000, Math.max(0, Math.round(settings.minDeltaChars || 0)))
    const memoryEnabled = settings.memory?.enabled !== false
    const next = new Map<string, AdvisorSlot>()
    for (const entry of settings.advisors) {
      const key = entry.name
      const existing = this.slots.get(key)
      if (existing) {
        existing.entry = entry
        existing.loop.updateEntry(entry)
        existing.loop.updateHostFlags({
          sessionId: this.host.sessionId,
          restorePointsEnabled: settings.restorePoints === true,
          completionGate: settings.completionGate !== false,
          memoryEnabled
        })
        if (existing.status === 'halted' || existing.status === 'error') {
          // Settings changed: give the advisor a fresh chance.
          existing.status = entry.enabled === false ? 'paused' : 'running'
          existing.consecutiveFailures = 0
          existing.lastError = undefined
          existing.haltReason = undefined
          existing.loop.resetConversation()
        } else if (entry.enabled === false) {
          existing.status = 'paused'
        } else if (existing.status === 'paused') {
          existing.status = 'running'
        }
        next.set(key, existing)
        continue
      }
      next.set(key, {
        entry,
        loop: new AdvisorLoop(
          {
            llm: this.host.llm,
            cwd: this.host.cwd,
            sessionId: this.host.sessionId,
            restorePointsEnabled: settings.restorePoints === true,
            completionGate: settings.completionGate !== false,
            memoryEnabled,
            onAdvice: (note, severity, advisorName, meta) => this.deliver(note, severity, advisorName, meta),
            onMemoryLesson: (lesson, advisorName) => this.host.onMemoryLesson?.(advisorName, lesson),
            log: this.host.log
          },
          entry
        ),
        cursor: 0,
        updateIndex: 1,
        status: entry.enabled === false ? 'paused' : 'running',
        backlog: 0,
        reviewsCompleted: 0,
        adviceDelivered: 0,
        consecutiveFailures: 0,
        draining: false,
        queued: [],
        deferredSkips: 0
      })
    }
    this.slots = next
  }

  /** Queue one review pass for every enabled advisor (called on step/turn end). */
  enqueueReview(inProgress: boolean): void {
    if (this.disposed) return
    for (const slot of this.slots.values()) {
      if (slot.status !== 'running') continue
      const last = slot.queued[slot.queued.length - 1]
      if (last && !last.retryText && last.inProgress === inProgress) continue
      slot.queued.push({ inProgress, attempt: 0 })
      slot.backlog = slot.queued.length
      void this.drain(slot)
    }
  }

  /** Restart a slot's drain loop after a delay (auto-retry of failed reviews). */
  private scheduleDrain(slot: AdvisorSlot, delayMs: number): void {
    const timer = setTimeout(() => {
      this.retryTimers.delete(timer)
      if (this.disposed) return
      // A quota status set for display must not block the scheduled retry.
      if (slot.status === 'quota_exhausted') slot.status = 'running'
      slot.quotaUntil = undefined
      void this.drain(slot)
    }, delayMs)
    this.retryTimers.add(timer)
  }

  private async drain(slot: AdvisorSlot): Promise<void> {
    if (slot.draining || this.disposed) return
    slot.draining = true
    try {
      while (!this.disposed && slot.queued.length > 0) {
        if (slot.status !== 'running') {
          slot.queued = []
          slot.backlog = 0
          return
        }
        if (slot.quotaUntil && Date.now() < slot.quotaUntil) return
        if (slot.quotaUntil && Date.now() >= slot.quotaUntil) {
          slot.quotaUntil = undefined
          slot.status = 'running'
        }

        const item = slot.queued.shift() as ReviewQueueItem
        slot.backlog = slot.queued.length

        let text: string
        if (item.retryText !== undefined) {
          // Auto-retry: re-review the exact delta that failed.
          text = item.retryText
        } else {
          const events = this.host.getEvents()
          const delta = renderDelta(events, slot.cursor, slot.updateIndex, item.inProgress)
          slot.cursor = delta.nextCursor
          text = delta.text
          if (!text.trim()) {
            continue // nothing renderable happened since the last review
          }
          // A user message is the highest-value content in any delta — a mid-session
          // correction is often the whole point of the turn — and it is also the only
          // content the skip logic can destroy outright. Never defer it.
          const hasUserMessage = /^### User$/m.test(text)
          const belowThreshold = this.minDeltaChars > 0 && text.trim().length < this.minDeltaChars
          if (belowThreshold && !hasUserMessage && slot.deferredSkips < DEFERRED_SKIP_LIMIT) {
            // Defer, do not drop. The cursor has already advanced, so the rendered
            // text is buffered here and prepended to the next review; dropping it
            // instead let a stream of small edits pass at zero aggregate coverage.
            slot.deferredText = slot.deferredText ? `${slot.deferredText}\n\n${text}` : text
            slot.deferredSkips++
            this.host.log?.('advisor review deferred (delta below minDeltaChars)', {
              session: this.host.sessionId,
              advisor: slot.entry.name,
              chars: text.trim().length,
              min: this.minDeltaChars,
              deferred: slot.deferredSkips
            })
            continue
          }
          // Reviewing now: fold in anything withheld so no stretch is reviewed twice
          // nor skipped entirely.
          if (slot.deferredText) {
            text = `${slot.deferredText}\n\n${text}`
            slot.deferredText = undefined
            slot.deferredSkips = 0
          }
        }

        const controller = new AbortController()
        const startedAt = Date.now()
        try {
          // Best-effort recall (v0.7.0): a failed recall degrades to a
          // memory-less review, never a failed review.
          let memoryContext: string | undefined
          if (this.host.recallMemory) {
            try {
              const recalled = await this.host.recallMemory(slot.entry.name, slot.entry.memoryEngines, text)
              if (recalled) memoryContext = recalled
            } catch (error) {
              this.host.log?.('memory recall skipped', {
                session: this.host.sessionId,
                advisor: slot.entry.name,
                error: String(error instanceof Error ? error.message : error)
              })
            }
          }
          await slot.loop.review(text, {
            inProgress: item.inProgress,
            signal: controller.signal,
            ...(memoryContext ? { memoryContext } : {})
          })
          slot.updateIndex++
          slot.reviewsCompleted++
          slot.consecutiveFailures = 0
          slot.lastError = undefined
          this.host.recordEvent?.('review-done', slot.entry.name, `${Date.now() - startedAt}ms`)
        } catch (error) {
          if (this.disposed) return
          slot.lastError = String(error instanceof Error ? error.message : error)
          this.host.log?.('advisor review failed', {
            session: this.host.sessionId,
            advisor: slot.entry.name,
            attempt: item.attempt,
            failures: slot.consecutiveFailures,
            error: slot.lastError
          })
          this.host.recordEvent?.('review-failed', slot.entry.name, slot.lastError)
          if (isPermanentFailure(error)) {
            slot.status = 'halted'
            slot.haltReason = 'permanent'
            slot.queued = []
            slot.backlog = 0
            this.host.recordEvent?.('halted', slot.entry.name, slot.lastError)
            return
          }
          if (isContextOverflow(error)) {
            // The advisor's accumulated history outgrew the model's context
            // window. Retrying the same bloated context can never succeed (and
            // with an unlimited retry cap would loop forever), so reset the
            // conversation to shrink it and retry once; a second overflow means
            // a single delta itself is too big, so halt instead of looping.
            if (!item.overflowRecovered) {
              slot.loop.resetConversation()
              slot.queued.unshift({
                inProgress: item.inProgress,
                retryText: text,
                attempt: item.attempt + 1,
                overflowRecovered: true
              })
              slot.backlog = slot.queued.length
              this.host.recordEvent?.('context-reset', slot.entry.name, 'advisor history exceeded model context; conversation reset')
              this.scheduleDrain(slot, this.autoRetryDelayMs)
              return
            }
            slot.status = 'halted'
            slot.haltReason = 'context-overflow'
            slot.queued = []
            slot.backlog = 0
            this.host.recordEvent?.('halted', slot.entry.name, `context overflow persists after reset: ${slot.lastError}`)
            return
          }
          if (this.autoRetry && (this.autoRetryMax === 0 || item.attempt < this.autoRetryMax)) {
            // Auto-retry the same delta after the configured delay. Quota
            // failures show as quota_exhausted meanwhile; scheduleDrain clears
            // both before the retry runs.
            if (isQuotaFailure(error)) slot.status = 'quota_exhausted'
            slot.queued.unshift({ inProgress: item.inProgress, retryText: text, attempt: item.attempt + 1 })
            slot.backlog = slot.queued.length
            this.host.recordEvent?.('retry', slot.entry.name, `attempt ${item.attempt + 1} in ${this.autoRetryDelayMs}ms`)
            this.scheduleDrain(slot, this.autoRetryDelayMs)
            return
          }
          slot.consecutiveFailures++
          if (isQuotaFailure(error)) {
            slot.status = 'quota_exhausted'
            slot.quotaUntil = Date.now() + QUOTA_COOLDOWN_MS
            this.host.recordEvent?.('quota', slot.entry.name, `cooldown ${QUOTA_COOLDOWN_MS / 1000}s`)
            return
          }
          if (slot.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            // Drop the backlog and start fresh rather than stall forever.
            slot.queued = []
            slot.backlog = 0
            slot.consecutiveFailures = 0
            slot.loop.resetConversation()
            this.host.recordEvent?.('backlog-dropped', slot.entry.name)
            return
          }
          // Brief backoff before the next queued item.
          await new Promise(resolve => setTimeout(resolve, 1500))
        }
      }
    } finally {
      slot.draining = false
    }
  }

  /**
   * Route one accepted advice note into the primary agent. With coalescing
   * enabled, non-interrupting notes from all advisors are buffered for the
   * coalesce window and emitted as one batched message; an interrupting note
   * flushes the whole batch immediately so a blocker never waits.
   */
  /**
   * The finding currently arming the tool gate, or undefined when this session
   * has none, the reported severity is not a gating one, or the user already
   * cleared it. The caller (service) decides whether the gate is enabled for the
   * tool being called and whether the denial bound has been reached.
   */
  gateBlock(): ToolGateBlock | undefined {
    if (this.disposed || !this.gate) return undefined
    if (!this.toolGate.severities.includes(this.gate.severity)) return undefined
    return {
      sessionId: this.host.sessionId,
      advisor: this.gate.advisor,
      severity: this.gate.severity,
      note: this.gate.note,
      denials: this.gate.denials,
      maxDenials: this.toolGate.maxDenials
    }
  }

  /** Count one call stopped by the current finding (called before refusing it). */
  recordGateDenial(): void {
    if (this.gate) this.gate.denials++
  }

  /** Clear the armed finding — the user acknowledged it, or work moved on. */
  clearGate(): boolean {
    if (!this.gate) return false
    this.gate = undefined
    return true
  }

  /**
   * Arm the gate from an accepted finding. A new finding replaces the previous
   * one and resets its denial count, so the bound is per-finding rather than per
   * session — an advisor that keeps raising fresh blockers keeps its veto.
   */
  private armGate(advisorName: string, severity: AdvisorSeverity | undefined, note: string): void {
    if (!severity || !this.toolGate.severities.includes(severity)) return
    this.gate = { advisor: advisorName, severity, note, denials: 0 }
  }

  private deliver(note: string, severity: AdvisorSeverity | undefined, advisorName: string, meta?: AdvisorNote['meta']): void {
    const advisorNote: AdvisorNote = { note, severity, advisor: advisorName, ...(meta ? { meta } : {}) }
    this.recentNotes.push(advisorNote)
    if (this.recentNotes.length > RECENT_NOTES_LIMIT) this.recentNotes.shift()
    this.armGate(advisorName, severity, note)

    const slot = this.slots.get(advisorName)
    if (slot) slot.adviceDelivered++

    if (!this.host.getAgent()) {
      this.host.log?.('advisor note dropped (no live agent)', { session: this.host.sessionId, advisorName })
      return
    }

    if (this.coalesceMs <= 0) {
      this.emitNotes([advisorNote])
      return
    }

    this.pendingNotes.push(advisorNote)
    if (isInterruptingSeverity(severity, this.interruptSeverities)) {
      this.flushNotes()
      return
    }
    if (this.coalesceTimer === undefined) {
      this.coalesceTimer = setTimeout(() => {
        this.coalesceTimer = undefined
        this.flushNotes()
      }, this.coalesceMs)
    }
  }

  /** Flush the coalesce buffer now (timer cancelled, notes emitted together). */
  private flushNotes(): void {
    if (this.coalesceTimer !== undefined) {
      clearTimeout(this.coalesceTimer)
      this.coalesceTimer = undefined
    }
    const notes = this.pendingNotes
    this.pendingNotes = []
    if (notes.length > 0) this.emitNotes(notes)
  }

  /** Emit a batch of notes, grouped by delivery channel (one message per channel). */
  private emitNotes(notes: AdvisorNote[]): void {
    const agent = this.host.getAgent()
    if (!agent) {
      this.host.log?.('advisor notes dropped (no live agent)', {
        session: this.host.sessionId,
        count: notes.length
      })
      return
    }
    const primaryRunning = agent.status === 'running'

    // Escalation (opt-in): a blocker raised while the primary is running
    // cancels the running step — undispatched parallel tool calls abort,
    // started ones commit — then wakes the agent with the whole batch as a
    // followup so it sees the reason and can react. Hosts without
    // agent.cancel fall through to the normal steer path.
    if (
      this.interveneOnBlocker &&
      primaryRunning &&
      typeof agent.cancel === 'function' &&
      notes.some(note => note.severity === 'blocker')
    ) {
      agent.cancel({ kind: 'advisor-blocker', plugin: 'dsh-omp-advisor' }, { keepInbox: true })
      agent.followup(this.createUserMessage(formatAdvisorBatchContent(notes)))
      this.host.log?.('advisor blocker intervention: cancelled running step', {
        session: this.host.sessionId,
        count: notes.length
      })
      this.host.recordEvent?.(
        'intervention',
        notes.map(note => note.advisor).join(', '),
        `cancelled running step (${notes.length} notes)`
      )
      return
    }

    const steerNotes: AdvisorNote[] = []
    const injectNotes: AdvisorNote[] = []
    const followupNotes: AdvisorNote[] = []
    for (const advisorNote of notes) {
      const channel = resolveDeliveryChannel({
        severity: advisorNote.severity,
        interruptSeverities: this.interruptSeverities,
        primaryRunning
      })
      if (channel === 'steer') steerNotes.push(advisorNote)
      else if (channel === 'followup') followupNotes.push(advisorNote)
      else injectNotes.push(advisorNote)
    }
    if (followupNotes.length > 0) {
      // The primary is idle: only `followup` wakes the driver.
      agent.followup(this.createUserMessage(formatAdvisorBatchContent(followupNotes)))
    }
    if (injectNotes.length > 0) {
      agent.inject(this.createUserMessage(formatAdvisorBatchContent(injectNotes)))
    }
    if (steerNotes.length > 0) {
      agent.steer(this.createUserMessage(formatAdvisorBatchContent(steerNotes)))
    }
    this.host.log?.('advisor notes delivered', {
      session: this.host.sessionId,
      count: notes.length,
      injected: injectNotes.length,
      steered: steerNotes.length,
      followedUp: followupNotes.length,
      coalesced: notes.length > 1
    })
    for (const advisorNote of notes) {
      this.host.recordEvent?.(
        'advice',
        advisorNote.advisor,
        `${advisorNote.severity ?? 'nit'} · ${steerNotes.includes(advisorNote) ? 'steer' : followupNotes.includes(advisorNote) ? 'followup' : 'inject'}`
      )
    }
  }

  /** Snapshot for the RPC surface. */
  snapshot(): { active: boolean; advisors: AdvisorStatusView[]; recentNotes: AdvisorNote[] } {
    return {
      active: this.slots.size > 0,
      advisors: [...this.slots.values()].map(slot => ({
        name: slot.entry.name,
        status: slot.status,
        backlog: slot.backlog,
        reviewsCompleted: slot.reviewsCompleted,
        adviceDelivered: slot.adviceDelivered,
        ...(slot.lastError ? { lastError: slot.lastError } : {}),
        ...(slot.haltReason ? { haltReason: slot.haltReason } : {})
      })),
      recentNotes: [...this.recentNotes]
    }
  }

  /**
   * Watch primary-turn outcomes for auto-retry. Fed from the session's
   * `turn/end` event. A failed turn (model error) schedules an automatic
   * "continue" followup message after the retry delay, bounded per failure
   * episode; completed turns reset the episode, and aborts or permanent
   * errors (unknown model/provider) never retry.
   */
  onTurnEnd(reason: unknown): void {
    if (this.disposed) return
    const data = (reason ?? {}) as TurnEndReason
    const kind = typeof data.kind === 'string' ? data.kind : ''
    if (kind !== 'error') {
      // Completed, aborted, max-tokens, …: the episode ends.
      this.continueAttempts = 0
      return
    }
    if (!this.autoRetry) return
    const message =
      (typeof data.error?.message === 'string' && data.error.message) ||
      (typeof data.error?.code === 'string' && data.error.code) ||
      'unknown error'
    if (isPermanentFailure(message)) {
      this.host.log?.('primary turn failed permanently; no auto-continue', {
        session: this.host.sessionId,
        error: message
      })
      return
    }
    if (this.autoRetryMax !== 0 && this.continueAttempts >= this.autoRetryMax) {
      this.host.log?.('primary turn failed; auto-retry attempts exhausted', {
        session: this.host.sessionId,
        attempts: this.continueAttempts,
        error: message
      })
      return
    }
    this.continueAttempts++
    const attempt = this.continueAttempts
    const capLabel = this.autoRetryMax === 0 ? '∞' : String(this.autoRetryMax)
    if (this.continueTimer !== undefined) clearTimeout(this.continueTimer)
    this.continueTimer = setTimeout(() => {
      this.continueTimer = undefined
      if (this.disposed) return
      const agent = this.host.getAgent()
      if (!agent) return
      const clipped = message.length > 200 ? `${message.slice(0, 200)}…` : message
      agent.followup(
        this.createUserMessage(
          `[dsh-omp-advisor auto-retry ${attempt}/${capLabel}] Your previous turn failed ("${clipped}"). Please continue from where you left off.`
        )
      )
      this.host.log?.('auto-continue sent after failed primary turn', {
        session: this.host.sessionId,
        attempt,
        error: message
      })
      this.host.recordEvent?.('continue-sent', undefined, `attempt ${attempt}/${capLabel}`)
    }, this.autoRetryDelayMs)
  }

  /** Pause or resume one advisor by name. */
  setPaused(name: string, paused: boolean): boolean {
    const slot = this.slots.get(name)
    if (!slot) return false
    if (paused) {
      slot.status = 'paused'
      slot.queued = []
      slot.backlog = 0
      slot.haltReason = undefined
    } else if (slot.status === 'paused') {
      slot.status = 'running'
    } else if (slot.status === 'halted' || slot.status === 'error' || slot.status === 'quota_exhausted') {
      // Manual resume of a stuck advisor (e.g. after a context-overflow halt):
      // drop the bloated/failed conversation, clear the failure state, and
      // re-arm with a fresh review so it starts immediately.
      slot.loop.resetConversation()
      slot.status = 'running'
      slot.lastError = undefined
      slot.haltReason = undefined
      slot.consecutiveFailures = 0
      slot.quotaUntil = undefined
      slot.queued = [{ inProgress: false, attempt: 0 }]
      slot.backlog = 1
      this.host.recordEvent?.('resumed', slot.entry.name, 'manually resumed; conversation reset')
      void this.drain(slot)
    }
    return true
  }

  dispose(): void {
    this.disposed = true
    if (this.coalesceTimer !== undefined) {
      clearTimeout(this.coalesceTimer)
      this.coalesceTimer = undefined
    }
    if (this.continueTimer !== undefined) {
      clearTimeout(this.continueTimer)
      this.continueTimer = undefined
    }
    for (const timer of this.retryTimers) clearTimeout(timer)
    this.retryTimers.clear()
    // A disposed session must not keep a live veto over tool calls.
    this.gate = undefined
    // Buffered notes are dropped: a disposed session must not receive advice.
    this.pendingNotes = []
    for (const slot of this.slots.values()) {
      slot.queued = []
      slot.backlog = 0
    }
    this.slots.clear()
  }
}

export { PLUGIN_NAME }
