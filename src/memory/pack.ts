/**
 * The single merge/pack layer for recalled memory (v0.7.0). Every adapter
 * emits normalized MemoryItems; this module caps, dedupes, budgets, and
 * renders them. Keeping it in one place means no adapter can bypass the
 * budget or inject raw content straight into an advisor prompt.
 */
import type { MemoryItem } from '../types'

/** Clip one recalled item's text (recall is context, not transcript). */
const ITEM_CHAR_CLIP = 1200

export function normalizeItem(engineId: string, raw: unknown, index: number): MemoryItem | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const item = raw as Partial<MemoryItem> & Record<string, unknown>
  const text = typeof item.text === 'string' ? item.text.trim() : ''
  if (!text) return undefined
  const score = typeof item.score === 'number' && Number.isFinite(item.score) ? item.score : 0
  const id =
    typeof item.id === 'string' && item.id
      ? item.id
      : typeof item.uri === 'string' && item.uri
        ? item.uri
        : `${engineId}:${index}`
  return {
    engineId,
    id,
    score,
    text: text.length > ITEM_CHAR_CLIP ? `${text.slice(0, ITEM_CHAR_CLIP)}…` : text
  }
}

export interface PackedMemory {
  items: MemoryItem[]
  dropped: number
}

/**
 * Merge recalled items across engines: per-engine cap, cross-engine dedup on
 * normalized text, stable score-desc → engineId → id ordering, and a total
 * character budget. Deterministic on identical input (no Map iteration order
 * leaks into the prompt).
 */
export function packMemoryItems(
  items: MemoryItem[],
  opts: { perEngineCap: number; budgetChars: number }
): PackedMemory {
  const perEngine = new Map<string, number>()
  const seen = new Set<string>()
  const kept: MemoryItem[] = []
  let dropped = 0

  const sorted = [...items].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (a.engineId !== b.engineId) return a.engineId.localeCompare(b.engineId)
    return a.id.localeCompare(b.id)
  })

  for (const item of sorted) {
    const count = perEngine.get(item.engineId) ?? 0
    if (count >= opts.perEngineCap) {
      dropped++
      continue
    }
    const fingerprint = item.text.toLowerCase().replace(/\s+/g, ' ').slice(0, 200)
    if (seen.has(fingerprint)) {
      dropped++
      continue
    }
    seen.add(fingerprint)
    perEngine.set(item.engineId, count + 1)
    kept.push(item)
  }

  const withinBudget: MemoryItem[] = []
  let used = 0
  for (const item of kept) {
    if (used + item.text.length > opts.budgetChars && withinBudget.length > 0) {
      dropped++
      continue
    }
    withinBudget.push(item)
    used += item.text.length
  }
  return { items: withinBudget, dropped }
}

/**
 * Render the packed items as the volatile prompt block. This block is
 * appended AFTER the static prompt sections and the delta, so prompt-prefix
 * caching stays stable across reviews.
 */
export function renderMemoryBlock(packed: PackedMemory): string {
  if (packed.items.length === 0) return ''
  const lines = packed.items.map(item => `- [${item.engineId}/${item.id}] ${item.text}`)
  const note =
    packed.dropped > 0 ? `\n(${packed.dropped} more recalled item${packed.dropped === 1 ? '' : 's'} omitted for budget)` : ''
  return (
    '<recalled-memory read-only="true">\n' +
    'Long-term memory recalled for this review. Treat as background context, verify before relying on it, never quote it back verbatim as if it were this session\'s content.\n' +
    lines.join('\n') +
    note +
    '\n</recalled-memory>'
  )
}
