/**
 * Advice delivery: render advisor notes as the agent-facing `<advisory>`
 * block and choose the DSH delivery channel.
 *
 * Ported semantics (oh-my-pi, MIT): advice, not orders — the primary agent's
 * only cue for how to treat advisories is the `guidance` attribute.
 *
 * DSH channel mapping:
 *  - non-interrupting notes ride `agent.inject(...)` — model-facing context
 *    claimed at the next step boundary, never waking the driver;
 *  - interrupting notes ride `agent.steer(...)` — consumed at the nearest
 *    step boundary by a running driver, or opening a turn when idle.
 */
import type { AdvisorDeliveryChannel, AdvisorNote, AdvisorSeverity } from './types'
import { restoreInstructions } from './restore-points'

const ADVISOR_GUIDANCE = 'weigh, don\'t blindly obey'

function escapeXmlText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeXmlAttribute(value: string): string {
  return escapeXmlText(value).replace(/"/g, '&quot;')
}

/**
 * Render a batch of advisor notes as the agent-facing message body: one
 * `<advisory>` element per note, severity and advisor as attributes.
 * Structured meta (rewind recommendation, acceptance + commit hint) is
 * rendered as nested sections inside the advisory.
 */
export function formatAdvisorBatchContent(notes: readonly AdvisorNote[]): string {
  return notes
    .map(note => {
      const severity = note.severity ? ` severity="${note.severity}"` : ''
      const who = note.advisor ? ` advisor="${escapeXmlAttribute(note.advisor)}"` : ''
      const sections = [escapeXmlText(note.note)]
      if (note.meta?.rewindTo) {
        sections.push(
          `<rewind point="${escapeXmlAttribute(note.meta.rewindTo.id)}">\n${escapeXmlText(
            restoreInstructions({
              id: note.meta.rewindTo.id,
              sha: note.meta.rewindTo.sha,
              tree: '',
              time: 0,
              turn: note.meta.rewindTo.turn
            })
          )}\n</rewind>`
        )
      }
      if (note.meta?.acceptance) {
        const label =
          note.meta.acceptance === 'completed'
            ? 'Work verified complete.'
            : 'User accepted the current state as a compromise.'
        const hint = note.meta.commitHint ? `\n${note.meta.commitHint}` : ''
        sections.push(`<accepted state="${escapeXmlAttribute(note.meta.acceptance)}">\n${escapeXmlText(label + hint)}\n</accepted>`)
      }
      return `<advisory${who}${severity} guidance="${ADVISOR_GUIDANCE}">\n${sections.join('\n')}\n</advisory>`
    })
    .join('\n')
}

/** Whether a severity interrupts the running agent (steer) rather than riding the aside queue (inject). */
export function isInterruptingSeverity(
  severity: AdvisorSeverity | undefined,
  interruptSeverities: readonly AdvisorSeverity[]
): boolean {
  return interruptSeverities.includes(severity ?? 'nit')
}

/**
 * Decide how one advisor note reaches the primary agent.
 *
 * @param severity - note severity (undefined = nit).
 * @param interruptSeverities - configured interrupting severities.
 * @param primaryRunning - whether the primary agent is actively running.
 *   While the primary is idle, an interrupting note downgrades to inject
 *   (context for the next turn) — except blocker, which may still steer and
 *   thereby wake a turn, matching oh-my-pi's idle-blocker behavior.
 */
export function resolveDeliveryChannel(opts: {
  severity: AdvisorSeverity | undefined
  interruptSeverities: readonly AdvisorSeverity[]
  primaryRunning: boolean
}): AdvisorDeliveryChannel {
  const { severity, interruptSeverities, primaryRunning } = opts
  if (!isInterruptingSeverity(severity, interruptSeverities)) return 'inject'
  if (primaryRunning) return 'steer'
  return severity === 'blocker' ? 'steer' : 'inject'
}
