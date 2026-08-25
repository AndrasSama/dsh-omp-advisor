/**
 * Minimal `createUserMessage` stub for the test bundle: mirrors the shape the
 * runtime relies on (a message object whose text assertions can read back).
 */
export function createUserMessage(init: { content?: unknown; source?: unknown }): {
  kind: 'user'
  text: string
  content: unknown[]
  source: unknown
} {
  const content = Array.isArray(init?.content) ? (init.content as unknown[]) : []
  const text = content
    .map(block => {
      const b = block as { type?: string; text?: unknown }
      return b && b.type === 'text' && typeof b.text === 'string' ? b.text : ''
    })
    .join('\n')
  return { kind: 'user', text, content, source: init?.source }
}
