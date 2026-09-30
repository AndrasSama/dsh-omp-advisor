/**
 * Transcript delta rendering: turn the durable session log past a cursor into
 * the incremental markdown update the advisor model reviews.
 *
 * Ported intent (oh-my-pi, MIT): the advisor receives incremental transcript
 * updates including thoughts, never the full history twice. DSH-native: the
 * source of truth is `session.events` (durable log), so the renderer walks
 * events past an index cursor.
 */
import type { SessionEvent } from './types'

export const PLUGIN_NAME = 'dsh-omp-advisor'

/** Bound for one rendered field so a huge tool result cannot flood the advisor. */
const TEXT_PREVIEW_LIMIT = 2000
const ARGS_PREVIEW_LIMIT = 400
/**
 * Tool arguments carry the entire risk of a mutation, so they get a wider window
 * than a read-only call's. Uniform truncation at 400 chars meant the advisor was
 * shown the *shape* of a write and none of its content, while the system prompt
 * simultaneously forbade it from asserting anything about unrendered arguments —
 * leaving it to either stay silent on the riskiest events or spend its whole
 * per-update budget re-reading what the delta had already been given.
 */
const MUTATING_ARGS_PREVIEW_LIMIT = 2000
/**
 * Reasoning is delivered tail-biased: the conclusion of a thought is what
 * carries the judgement, and a long chain read from the top is mostly context
 * the model already has from the transcript.
 */
const REASONING_PREVIEW_LIMIT = 1200

/** Tools whose arguments are the change itself. */
const MUTATING_TOOLS = new Set([
  'write', 'edit', 'multiedit', 'multi_edit', 'patch', 'apply_patch',
  'bash', 'shell', 'run', 'exec', 'notebook_edit', 'str_replace_editor'
])
/** Argument keys that make any call content-bearing, whatever the tool is called. */
const HIGH_RISK_ARG_KEYS = [
  'content', 'new_string', 'newText', 'new_str', 'new_str', 'command',
  'patch', 'script', 'source', 'body', 'text', 'old_string'
]

export interface RenderedDelta {
  /** Markdown update body (empty string when nothing renderable happened). */
  text: string
  /** Event index to continue from (exclusive). */
  nextCursor: number
  /** Text of every tool result rendered into this delta (quarantine provenance). */
  toolResultTexts: string[]
}

function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text
  return `${text.slice(0, limit)}\n…[truncated ${text.length - limit} chars]`
}

/** Keep the END of a long field, flagging the elided head. */
function truncateTail(text: string, limit: number): string {
  if (text.length <= limit) return text
  return `…[${text.length - limit} chars elided]…\n${text.slice(-limit)}`
}

/** Extract plain text from a message content block list. */
function blocksToText(content: unknown): string {
  if (!Array.isArray(content)) return ''
  const parts: string[] = []
  for (const block of content) {
    if (block && typeof block === 'object') {
      const b = block as { type?: string; text?: unknown }
      if (b.type === 'text' && typeof b.text === 'string') parts.push(b.text)
    }
  }
  return parts.join('\n')
}

/**
 * Split a content block list into final text and reasoning text.
 *
 * DSH persists `{ type: 'reasoning' }` blocks in `assistant/message` events (they
 * are present in real session logs), and this renderer used to drop them while
 * `system.md` promised the advisor the transcript "including thoughts". That made
 * the advisor mistake *unrendered* reasoning for *absent* reasoning and raise
 * exactly the "skipped reasoning" challenge the prompt forbids.
 */
function blocksToParts(content: unknown): { text: string; reasoning: string } {
  if (!Array.isArray(content)) return { text: '', reasoning: '' }
  const texts: string[] = []
  const thoughts: string[] = []
  for (const block of content) {
    if (!block || typeof block !== 'object') continue
    const b = block as { type?: string; text?: unknown }
    if (typeof b.text !== 'string') continue
    if (b.type === 'text') texts.push(b.text)
    else if (b.type === 'reasoning') thoughts.push(b.text)
  }
  return { text: texts.join('\n'), reasoning: thoughts.join('\n') }
}

/**
 * Whether this call's arguments are the change itself and deserve the wide window.
 * Falls back to inspecting the raw argument JSON for content-bearing keys, so a
 * mutation arriving through an unfamiliar tool name is still shown in full.
 *
 * Matched as substrings rather than by parsing: the arguments can be megabytes,
 * a parse would fail on any truncated payload, and a false positive here only
 * costs a few extra rendered characters.
 */
function argsPreviewLimit(name: string, args: string): number {
  if (MUTATING_TOOLS.has(name.toLowerCase())) return MUTATING_ARGS_PREVIEW_LIMIT
  for (const key of HIGH_RISK_ARG_KEYS) {
    if (args.includes(`"${key}"`)) return MUTATING_ARGS_PREVIEW_LIMIT
  }
  return ARGS_PREVIEW_LIMIT
}

function isOwnPluginMessage(data: any): boolean {
  return data?.source?.kind === 'plugin' && data?.source?.plugin === PLUGIN_NAME
}

/**
 * Render session events in `[cursor, events.length)` as one advisor update.
 *
 * @param events - the session's durable event list.
 * @param cursor - first event index to render.
 * @param updateIndex - ordinal of this update in the advisor's conversation.
 * @param inProgress - true while the primary turn is still running
 *   (`reviewTrigger: 'step'`); tags the heading so the advisor withholds
 *   critique of partial work.
 */
export function renderDelta(
  events: readonly SessionEvent[],
  cursor: number,
  updateIndex: number,
  inProgress: boolean
): RenderedDelta {
  const sections: string[] = []
  const toolResultTexts: string[] = []
  const toolNames = new Map<string, string>()
  let index = Math.max(0, cursor)

  for (; index < events.length; index++) {
    const event = events[index]
    if (!event || typeof event.type !== 'string') continue
    const data: any = (event as any).data ?? event

    switch (event.type) {
      case 'user/message': {
        if (isOwnPluginMessage(data)) break // never re-review our own advisories
        const text = blocksToText(data.content)
        if (text.trim()) sections.push(`### User\n${truncate(text, TEXT_PREVIEW_LIMIT)}`)
        break
      }
      case 'assistant/message': {
        const message = data.message
        const { text, reasoning } = blocksToParts(message?.content)
        const interrupted = data.interrupted === true ? ' (interrupted)' : ''
        if (reasoning.trim()) {
          sections.push(`### Assistant reasoning${interrupted}\n${truncateTail(reasoning, REASONING_PREVIEW_LIMIT)}`)
        }
        if (text.trim()) sections.push(`### Assistant${interrupted}\n${truncate(text, TEXT_PREVIEW_LIMIT)}`)
        break
      }
      case 'tool/call': {
        const name = typeof data.name === 'string' ? data.name : 'tool'
        if (typeof data.callId === 'string') toolNames.set(data.callId, name)
        let argsPreview = ''
        if (typeof data.arguments === 'string' && data.arguments.trim() && data.arguments.trim() !== '{}') {
          const limit = argsPreviewLimit(name, data.arguments)
          argsPreview = `\n\`\`\`json\n${truncate(data.arguments, limit)}\n\`\`\``
        }
        sections.push(`### Tool call: ${name}${argsPreview}`)
        break
      }
      case 'tool/result': {
        const message = data.message
        const callId = typeof message?.content?.[0]?.toolCallId === 'string'
          ? message.content[0].toolCallId
          : undefined
        const name = (callId && toolNames.get(callId)) || 'tool'
        const text = blocksToText(message?.content?.[0]?.content ?? message?.content)
        const isError = data.error !== undefined || message?.content?.[0]?.isError === true
        const status = isError ? ' (error)' : ''
        const body = text.trim() ? truncate(text, TEXT_PREVIEW_LIMIT) : '(no output)'
        toolResultTexts.push(body)
        sections.push(`### Tool result: ${name}${status}\n${body}`)
        break
      }
      default:
        break // turn/step boundaries, chunks, todos, headers: structure only
    }
  }

  if (sections.length === 0) {
    return { text: '', nextCursor: index, toolResultTexts }
  }

  const heading = inProgress
    ? `## Update ${updateIndex} [in progress — more steps follow]`
    : `## Update ${updateIndex}`
  return {
    text: `${heading}\n\n${sections.join('\n\n')}`,
    nextCursor: index,
    toolResultTexts
  }
}
