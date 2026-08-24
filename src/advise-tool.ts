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
import type { AdvisorSeverity } from './types'

const SEVERITY_RANK: Record<AdvisorSeverity, number> = { nit: 1, concern: 2, blocker: 3 }

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
  private deferredNotes: { key: string; note: string; severity?: AdvisorSeverity }[] = []

  constructor(
    private readonly onAdvice: (note: string, severity?: AdvisorSeverity) => void
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
      for (const item of pending) this.deliver(item.note, item.severity)
    }
  }

  /** Clear delivered-note memory when the advisor starts a fresh conversation. */
  resetDeliveredNotes(): void {
    this.deliveredRanks.clear()
    this.inProgressUpdate = false
    this.deferredNotes = []
  }

  /** Number of notes withheld for the in-flight primary turn. */
  get deferredCount(): number {
    return this.deferredNotes.length
  }

  /** Run one advise call through deferral + dedupe. */
  advise(note: string, severity?: AdvisorSeverity): AdviseResult {
    if (this.inProgressUpdate && severity !== 'blocker') {
      const key = dedupeKey(note)
      const pending = this.deferredNotes.find(item => item.key === key)
      if (!pending) {
        this.deferredNotes.push({ key, note, severity })
      } else if (severityRank(severity) > severityRank(pending.severity)) {
        pending.severity = severity
      }
      return {
        modelReply:
          'Deferred — primary is mid-turn; this note will be delivered automatically when the turn completes. Do not re-raise the same point.',
        delivered: false,
        deferred: true
      }
    }
    const delivered = this.deliver(note, severity)
    return {
      modelReply: delivered ? 'Recorded.' : 'Duplicate advice ignored.',
      delivered,
      deferred: false
    }
  }

  /** Escalation-rank dedupe; returns true when the note was delivered. */
  private deliver(note: string, severity?: AdvisorSeverity): boolean {
    const key = dedupeKey(note)
    const rank = severityRank(severity)
    const previousRank = this.deliveredRanks.get(key) ?? 0
    if (rank <= previousRank) return false
    this.deliveredRanks.set(key, rank)
    this.onAdvice(note, severity)
    return true
  }
}

/** JSON Schema for the model-facing `advise` tool. */
export const ADVISE_TOOL_SCHEMA = {
  name: 'advise',
  description:
    'Watched agent: send 1 concrete, terse advice.\nUse sparingly; stay silent when nothing matters.\nCall to avert likely-wrong or materially wasteful work.',
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
        description: 'How strongly to weigh this. Omit for a plain nit.'
      }
    }
  }
} as const
