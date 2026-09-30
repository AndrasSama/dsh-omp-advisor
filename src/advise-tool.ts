/**
 * The advisor-side `advise` semantics, ported from oh-my-pi
 * (can1357/oh-my-pi, MIT — see NOTICE-oh-my-pi-LICENSE).
 *
 * The advisor model calls `advise` with one concrete note and an optional
 * severity. Notes pass an escalation-rank dedupe (a note only re-delivers at
 * a strictly higher severity: nit -> concern -> blocker). While the primary
 * agent is mid-turn, non-blockers are deferred and flushed deterministically
 * when the turn completes, so partial work is not interrupted and no advice
 * is lost.
 */
import type { AdvisorSeverity, AdviceOutcome } from './types'

/**
 * Tell the advisor exactly what its call did.
 *
 * A gating severity is not merely advice: it arms a veto over the watched
 * agent's next mutating tool call. The advisor used to receive a bare
 * `Recorded.` for a note that had just blocked a tool call — it could neither
 * calibrate the severity it chose nor notice that the gate had stood down after
 * the denial bound, which is precisely the feedback a peer reviewer needs.
 */
function recordedReply(outcome: AdviceOutcome | undefined): string {
  if (!outcome?.gated) return 'Recorded.'
  return (
    'Recorded — this note GATES the watched agent: its next mutating tool call ' +
    `(write/edit/bash) is refused, up to ${outcome.maxDenials} times, after which the gate stands down ` +
    'and calls proceed again. The gate stays armed until the user acknowledges it or newer work supersedes it, ' +
    'and a fresh finding replaces this one. Escalate only when you mean to stop work.'
  )
}

const SEVERITY_RANK: Record<AdvisorSeverity, number> = { nit: 1, concern: 2, blocker: 3 }

/**
 * Structured extras an advisor may attach to an advice note (validated by
 * the loop before delivery; the runtime renders them into the advisory).
 */
export interface AdviceMeta {
  /** Validated restore point the advisor recommends rewinding to. */
  rewindTo?: { id: string; sha: string; turn?: number }
  /** Completion-gate acceptance signal for the current work state. */
  acceptance?: 'completed' | 'compromise-accepted'
  /** Commit recipe for the accepted state (branch + honest-report message). */
  commitHint?: string
}

export function severityRank(severity: AdvisorSeverity | undefined): number {
  return SEVERITY_RANK[severity ?? 'nit']
}

function dedupeKey(note: string): string {
  return note.trim().replace(/\s+/g, ' ')
}

export interface AdviseResult {
  /** Text returned to the advisor model. */
  modelReply: string
  /** True when the note was delivered now, false when duplicate-suppressed. */
  delivered: boolean
  /** True when the note was deferred until the turn completes. */
  deferred: boolean
  /** Set when this note armed the tool-call gate, so the model can be told. */
  outcome?: AdviceOutcome
}

/**
 * Stateful advise gate for one advisor. Feed tool calls through `advise`;
 * call `beginUpdate(false)` when the primary turn completes to flush
 * deferred notes oldest-first.
 */
export class AdviseGate {
  /** Highest delivered severity rank per normalized note. */
  private deliveredRanks = new Map<string, number>()
  private inProgressUpdate = false
  private deferredNotes: { key: string; note: string; severity?: AdvisorSeverity; meta?: AdviceMeta }[] = []

  constructor(
    private readonly onAdvice: (note: string, severity?: AdvisorSeverity, meta?: AdviceMeta) => AdviceOutcome | undefined
  ) {}

  /**
   * Mark whether the next advisor prompt reviews an in-progress primary turn.
   * Non-blockers are withheld until a completed update so partial work does
   * not interrupt the primary before it can finish its planned steps.
   */
  beginUpdate(inProgress: boolean): void {
    const wasInProgress = this.inProgressUpdate
    this.inProgressUpdate = inProgress
    if (wasInProgress && !inProgress && this.deferredNotes.length > 0) {
      const pending = this.deferredNotes
      this.deferredNotes = []
      for (const item of pending) this.deliver(item.note, item.severity, item.meta)
    }
  }

  /**
   * Clear the state that belongs to the in-flight primary turn.
   *
   * `deliveredRanks` is deliberately KEPT. It is not review context: it records
   * what the user has already been TOLD, and dropping the transcript does not
   * un-tell them. Clearing it on a context reset let the advisor re-deliver a
   * note it had already delivered at the same severity — repetition that lands
   * precisely when a long session has just been forced to start over.
   *
   * Escalation still gets through after a reset: dedupe suppresses only the same
   * or a lower severity, so a still-open issue can be re-raised at a higher one.
   */
  resetTurnState(): void {
    this.inProgressUpdate = false
    this.deferredNotes = []
  }

  /** Number of notes withheld for the in-flight primary turn. */
  get deferredCount(): number {
    return this.deferredNotes.length
  }

  /** Run one advise call through deferral + dedupe. */
  advise(note: string, severity?: AdvisorSeverity, meta?: AdviceMeta): AdviseResult {
    if (this.inProgressUpdate && severity !== 'blocker') {
      const key = dedupeKey(note)
      const pending = this.deferredNotes.find(item => item.key === key)
      if (!pending) {
        this.deferredNotes.push({ key, note, severity, meta })
      } else {
        if (severityRank(severity) > severityRank(pending.severity)) {
          pending.severity = severity
        }
        if (meta) pending.meta = meta
      }
      return {
        modelReply:
          'Deferred — primary is mid-turn; this note will be delivered automatically when the turn completes. Do not re-raise the same point.',
        delivered: false,
        deferred: true
      }
    }
    const outcome = this.deliver(note, severity, meta)
    const delivered = outcome !== undefined
    return {
      modelReply: delivered ? recordedReply(outcome) : 'Duplicate advice ignored.',
      delivered,
      deferred: false,
      ...(outcome ? { outcome } : {})
    }
  }

  /**
   * Escalation-rank dedupe. Returns the delivery outcome (undefined when the
   * note was suppressed as a duplicate).
   */
  private deliver(note: string, severity?: AdvisorSeverity, meta?: AdviceMeta): AdviceOutcome | undefined {
    const key = dedupeKey(note)
    const rank = severityRank(severity)
    const previousRank = this.deliveredRanks.get(key) ?? 0
    if (rank <= previousRank) return undefined
    this.deliveredRanks.set(key, rank)
    return this.onAdvice(note, severity, meta)
  }
}

/** JSON Schema for the model-facing `advise` tool. */
export const ADVISE_TOOL_SCHEMA = {
  name: 'advise',
  description:
    'Watched agent: send 1 concrete, terse advice.\nUse sparingly; stay silent when nothing matters.\nCall to avert likely-wrong or materially wasteful work.\nA `blocker` is not just advice: it refuses the agent\'s next mutating tool call until the gate stands down.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    required: ['note'],
    properties: {
      note: {
        type: 'string',
        description: 'One concrete piece of advice for the agent you are watching. Terse, specific, actionable.'
      },
      severity: {
        type: 'string',
        enum: ['nit', 'concern', 'blocker'],
        description:
          'How strongly to weigh this. Omit for a plain nit. `concern` offers a view the agent decides on; `blocker` refuses the agent\'s next mutating tool call (bounded), so escalate only to stop work.'
      },
      rewindTo: {
        type: 'string',
        description:
          'Optional restore point id (from list_restore_points) to recommend rewinding to after a destructive or wrong step. When set, the note MUST contain a "Do not repeat:" section naming the destructive steps and a "Keep (progress):" section naming the steps worth preserving.'
      },
      acceptance: {
        type: 'string',
        enum: ['completed', 'compromise-accepted'],
        description:
          'Completion gate only: set when the requested work is verified fully implemented (completed) or the user explicitly accepted the current partial state as a compromise (compromise-accepted). The advisory then reminds the agent to commit the accepted state to its working branch.'
      }
    }
  }
} as const
