/**
 * The advisor's default investigation toolset: read-only `read`, `grep`,
 * `glob`, confined to the watched session's working directory. This matches
 * oh-my-pi's default advisor grant (read/grep/glob); mutating tools are
 * deliberately out of scope for v1.
 */
import { readFile, readdir, stat } from 'node:fs/promises'
import { resolve, relative, join } from 'node:path'
import { PACKAGED_SKILLS } from './skills.generated'

const OUTPUT_LIMIT = 8000
const MAX_GREP_FILES = 200
const MAX_GLOB_RESULTS = 100
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.cache', '__pycache__'])

function confine(cwd: string, target: string): string {
  const abs = resolve(cwd, target)
  const rel = relative(cwd, abs)
  if (rel.startsWith('..') || resolve(cwd, rel) !== abs) {
    throw new Error(`path escapes the session workspace: ${target}`)
  }
  return abs
}

function clip(text: string): string {
  if (text.length <= OUTPUT_LIMIT) return text
  return `${text.slice(0, OUTPUT_LIMIT)}\n…[truncated ${text.length - OUTPUT_LIMIT} chars]`
}

export interface AdvisorToolContext {
  /** Absolute working directory of the watched session. */
  cwd: string
}

export interface AdvisorToolResult {
  text: string
  isError?: boolean
}

async function readTool(ctx: AdvisorToolContext, args: { path: string; offset?: number; limit?: number }): Promise<AdvisorToolResult> {
  const abs = confine(ctx.cwd, args.path)
  const raw = await readFile(abs, 'utf8')
  const lines = raw.split('\n')
  const offset = Math.max(1, args.offset ?? 1)
  const limit = Math.min(Math.max(1, args.limit ?? 400), 2000)
  const slice = lines.slice(offset - 1, offset - 1 + limit)
  const numbered = slice.map((line, i) => `${offset + i}: ${line}`).join('\n')
  return { text: clip(numbered) }
}

async function walk(dir: string, out: string[], budget: number): Promise<void> {
  if (out.length >= budget) return
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (out.length >= budget) return
    if (entry.isSymbolicLink()) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue
      await walk(full, out, budget)
    } else if (entry.isFile()) {
      out.push(full)
    }
  }
}

async function grepTool(ctx: AdvisorToolContext, args: { pattern: string; path?: string }): Promise<AdvisorToolResult> {
  let regex: RegExp
  try {
    regex = new RegExp(args.pattern)
  } catch (err) {
    return { text: `invalid regex: ${String(err)}`, isError: true }
  }
  const root = confine(ctx.cwd, args.path ?? '.')
  const rootStat = await stat(root).catch(() => undefined)
  if (!rootStat) return { text: `no such path: ${args.path}`, isError: true }

  const files: string[] = []
  if (rootStat.isFile()) files.push(root)
  else await walk(root, files, MAX_GREP_FILES)

  const matches: string[] = []
  for (const file of files) {
    let raw: string
    try {
      raw = await readFile(file, 'utf8')
    } catch {
      continue
    }
    if (raw.includes('\u0000')) continue // binary
    const lines = raw.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        matches.push(`${relative(ctx.cwd, file)}:${i + 1}: ${lines[i].slice(0, 300)}`)
        if (matches.length >= 100) return { text: clip(matches.join('\n') + '\n…[more matches truncated]') }
      }
    }
  }
  return { text: matches.length > 0 ? clip(matches.join('\n')) : 'no matches' }
}

function globMatch(name: string, pattern: string): boolean {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\u0000/g, '.*')
    .replace(/\?/g, '.')
  return new RegExp(`^${escaped}$`).test(name)
}

async function globTool(ctx: AdvisorToolContext, args: { pattern: string; path?: string }): Promise<AdvisorToolResult> {
  const root = confine(ctx.cwd, args.path ?? '.')
  const files: string[] = []
  await walk(root, files, 5000)
  const matched = files
    .map(file => relative(ctx.cwd, file))
    .filter(rel => globMatch(rel, args.pattern) || globMatch(rel.split('/').pop() ?? '', args.pattern))
    .sort()
    .slice(0, MAX_GLOB_RESULTS)
  return { text: matched.length > 0 ? matched.join('\n') : 'no matches' }
}

/** Tool schemas sent to the advisor model. */
export const ADVISOR_TOOL_SCHEMAS = [
  {
    name: 'read',
    description: 'Read a UTF-8 text file from the watched workspace; returns line-numbered content.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['path'],
      properties: {
        path: { type: 'string', description: 'File path relative to the workspace root.' },
        offset: { type: 'number', description: '1-based first line to return. Defaults to 1.' },
        limit: { type: 'number', description: 'Maximum lines to return. Defaults to 400.' }
      }
    }
  },
  {
    name: 'grep',
    description: 'Search file contents in the watched workspace with a regular expression; returns matching lines with file:line locations.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['pattern'],
      properties: {
        pattern: { type: 'string', description: 'Regular expression to search for.' },
        path: { type: 'string', description: 'File or directory to search. Defaults to the workspace root.' }
      }
    }
  },
  {
    name: 'glob',
    description: 'Find files in the watched workspace whose paths match a glob pattern (supports *, **, ?).',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['pattern'],
      properties: {
        pattern: { type: 'string', description: 'Glob pattern, e.g. "src/**/*.ts".' },
        path: { type: 'string', description: 'Directory to search in. Defaults to the workspace root.' }
      }
    }
  }
] as const

/**
 * Skill loader schema, granted only in `lazy` skill mode (bodies fetched on
 * demand instead of embedded in the system prompt).
 */
export const LOAD_SKILL_TOOL_SCHEMA = {
  name: 'load_skill',
  description:
    'Load the full body of one packaged advisor skill by id. Use it to read a skill listed in your <skills> index before relying on it.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    required: ['id'],
    properties: {
      id: { type: 'string', description: 'Skill id from the <skills> index, e.g. "defensive-patterns".' }
    }
  }
} as const

/** Names granted to advisors by default (the oh-my-pi default subset). */
export const DEFAULT_ADVISOR_TOOL_NAMES: ReadonlySet<string> = new Set(['read', 'grep', 'glob', 'advise', 'load_skill'])

async function loadSkillTool(_ctx: AdvisorToolContext, args: { id: string }): Promise<AdvisorToolResult> {
  const id = String(args.id ?? '').trim()
  const skill = PACKAGED_SKILLS[id]
  if (!skill) {
    const known = Object.keys(PACKAGED_SKILLS)
      .filter(k => k.includes(id))
      .slice(0, 8)
    return {
      text: `unknown skill id "${id}"${known.length > 0 ? ` — did you mean: ${known.join(', ')}?` : ''}`,
      isError: true
    }
  }
  return { text: clip(skill.body) }
}

/** Execute one advisor tool call. Unknown tools throw. */
export async function executeAdvisorTool(
  ctx: AdvisorToolContext,
  name: string,
  rawArguments: string
): Promise<AdvisorToolResult> {
  let args: any = {}
  if (rawArguments.trim()) {
    try {
      args = JSON.parse(rawArguments)
    } catch {
      return { text: 'arguments are not valid JSON', isError: true }
    }
  }
  try {
    switch (name) {
      case 'read':
        if (typeof args.path !== 'string') return { text: 'path is required', isError: true }
        return await readTool(ctx, args)
      case 'grep':
        if (typeof args.pattern !== 'string') return { text: 'pattern is required', isError: true }
        return await grepTool(ctx, args)
      case 'glob':
        if (typeof args.pattern !== 'string') return { text: 'pattern is required', isError: true }
        return await globTool(ctx, args)
      case 'load_skill':
        if (typeof args.id !== 'string') return { text: 'id is required', isError: true }
        return await loadSkillTool(ctx, args)
      default:
        throw new Error(`unknown advisor tool: ${name}`)
    }
  } catch (err) {
    return { text: String(err instanceof Error ? err.message : err), isError: true }
  }
}
