/**
 * The built-in plaintext memory engine (v0.7.0): one append-only markdown
 * lesson file per workspace at `<cwd>/.dsh-omp-advisor/lessons.md`, plus a
 * deterministic BM25-lite keyword recall. Zero LLM calls, zero dependencies,
 * human-editable — the ecosystem-native DSH memory shape.
 *
 * Entry format (stable, parsed back on load):
 *
 *   ## 2026-08-25T20:30:00.000Z [The Clarifier] tags: api, retry
 *   Lesson text…
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { MemoryItem } from '../types'

export const MEMORY_DIR_NAME = '.dsh-omp-advisor'
export const LESSONS_FILE_NAME = 'lessons.md'

export interface LessonEntry {
  time: string
  advisor: string
  tags: string[]
  text: string
}

export function lessonsPath(cwd: string): string {
  return join(cwd, MEMORY_DIR_NAME, LESSONS_FILE_NAME)
}

/** Serialize one lesson as a markdown entry (single entry, no rewrites). */
export function renderLessonEntry(lesson: { text: string; advisor: string; tags: string[] }, time = new Date()): string {
  const tags = lesson.tags.map(tag => tag.trim()).filter(Boolean).slice(0, 8)
  const header = `## ${time.toISOString()} [${lesson.advisor}]${tags.length > 0 ? ` tags: ${tags.join(', ')}` : ''}`
  return `${header}\n${lesson.text.trim()}\n`
}

/** Parse a lessons file back into entries (tolerant of hand edits). */
export function parseLessons(content: string): LessonEntry[] {
  const entries: LessonEntry[] = []
  const lines = content.split('\n')
  let current: LessonEntry | undefined
  const flush = (): void => {
    if (current && current.text.trim()) entries.push(current)
    current = undefined
  }
  for (const line of lines) {
    const match = /^## (\S+) \[([^\]]*)\](?:\s*tags:\s*(.*))?$/.exec(line)
    if (match) {
      flush()
      const tags = (match[3] ?? '')
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean)
      current = { time: match[1], advisor: match[2], tags, text: '' }
      continue
    }
    if (current) current.text += `${line}\n`
  }
  flush()
  return entries
}

/** Append one lesson; skips exact-duplicate text already in the file. */
export async function appendLesson(
  cwd: string,
  lesson: { text: string; advisor: string; tags: string[] }
): Promise<{ appended: boolean; reason?: string }> {
  const text = lesson.text.trim()
  if (!text) return { appended: false, reason: 'empty lesson' }
  const path = lessonsPath(cwd)
  let existing = ''
  try {
    existing = await readFile(path, 'utf8')
  } catch {
    /* first lesson: no file yet */
  }
  const normalized = text.toLowerCase().replace(/\s+/g, ' ')
  for (const entry of parseLessons(existing)) {
    if (entry.text.trim().toLowerCase().replace(/\s+/g, ' ') === normalized) {
      return { appended: false, reason: 'duplicate' }
    }
  }
  await mkdir(join(cwd, MEMORY_DIR_NAME), { recursive: true })
  await writeFile(path, existing + (existing && !existing.endsWith('\n') ? '\n' : '') + renderLessonEntry(lesson) + '\n', 'utf8')
  return { appended: true }
}

/** Tokenize for keyword scoring (lowercase word chars, len >= 3, stopword-free). */
export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9_\-./]{3,}/g) ?? []).slice(0, 200)
}

/**
 * Deterministic BM25-lite recall over the workspace lessons: term overlap
 * weighted by inverse frequency, tag hits boosted. No embeddings, no LLM.
 */
export function recallLessons(entries: LessonEntry[], query: string, limit: number): MemoryItem[] {
  const terms = [...new Set(tokenize(query))]
  if (terms.length === 0 || entries.length === 0) return []
  const docFreq = new Map<string, number>()
  const docs = entries.map((entry, index) => {
    const body = `${entry.text} ${entry.tags.join(' ')}`
    const tokens = tokenize(body)
    const tf = new Map<string, number>()
    for (const token of tokens) tf.set(token, (tf.get(token) ?? 0) + 1)
    for (const token of new Set(tokens)) docFreq.set(token, (docFreq.get(token) ?? 0) + 1)
    return { entry, index, tf, tagSet: new Set(entry.tags.map(tag => tag.toLowerCase())) }
  })
  const n = docs.length
  const scored = docs.map(doc => {
    let score = 0
    for (const term of terms) {
      const tf = doc.tf.get(term) ?? 0
      if (tf === 0) continue
      const idf = Math.log(1 + (n - (docFreq.get(term) ?? 0) + 0.5) / ((docFreq.get(term) ?? 0) + 0.5))
      score += idf * ((tf * 2.2) / (tf + 1.2))
      if (doc.tagSet.has(term)) score += 0.5 // tag hit boost
    }
    return { doc, score }
  })
  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || b.doc.index - a.doc.index)
    .slice(0, limit)
    .map(item => ({
      engineId: 'builtin-md',
      id: `lesson-${item.doc.index + 1}`,
      score: Math.round(item.score * 1000) / 1000,
      text: item.doc.entry.text.trim()
    }))
}

/** Load + recall in one call (missing file = empty result, never throws). */
export async function recallFromWorkspace(cwd: string, query: string, limit: number): Promise<MemoryItem[]> {
  try {
    const content = await readFile(lessonsPath(cwd), 'utf8')
    return recallLessons(parseLessons(content), query, limit)
  } catch {
    return []
  }
}
