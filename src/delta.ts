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
        const text = blocksToText(message?.content)
        const interrupted = data.interrupted === true ? ' (interrupted)' : ''
        if (text.trim()) sections.push(`### Assistant${interrupted}\n${truncate(text, TEXT_PREVIEW_LIMIT)}`)
        break
      }
      case 'tool/call': {
        const name = typeof data.name === 'string' ? data.name : 'tool'
        if (typeof data.callId === 'string') toolNames.set(data.callId, name)
        let argsPreview = ''
        if (typeof data.arguments === 'string' && data.arguments.trim() && data.arguments.trim() !== '{}') {
          argsPreview = `\n\`\`\`json\n${truncate(data.arguments, ARGS_PREVIEW_LIMIT)}\n\`\`\``
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
