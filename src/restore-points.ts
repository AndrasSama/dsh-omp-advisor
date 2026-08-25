/**
 * Git restore points: side-effect-free workspace snapshots for advisor-guided
 * rewind and the completion gate.
 *
 * Mechanic (validated): a throwaway index file (`GIT_INDEX_FILE` pointing at a
 * NONEXISTENT path) captures the worktree — tracked modifications AND untracked
 * files, honoring .gitignore — via `git add -A` + `git write-tree`, then
 * `git commit-tree` (chained to the session's previous point) stores it as a
 * commit object under the hidden ref namespace `refs/dsh-omp-advisor/**`.
 *
 * Safety boundary (design borrowed from dsh-checkpoint-rewind / dsh-turn-rewind):
 *  - the user's index, HEAD, branch, and worktree are NEVER touched;
 *  - only an allowlist of git verbs is ever executed;
 *  - refs/spliced object ids are SHA-format validated (injection defense);
 *  - prompts disabled, optional locks off, hard timeouts on every spawn;
 *  - restore is worktree-only and keeps files created after the point
 *    (the primary model deletes deliberately, never the plugin);
 *  - all failures resolve to null/empty — restore points never break a session.
 *
 * State lives entirely inside the watched repo (hidden refs + JSON trailers in
 * commit messages); there is no external storage to drift.
 */
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** Git verbs this module is allowed to execute (runtime-asserted). */
const ALLOWED_VERBS = new Set([
  'rev-parse',
  'status',
  'add',
  'write-tree',
  'commit-tree',
  'update-ref',
  'for-each-ref',
  'diff',
  'ls-tree',
  'ls-files',
  'restore',
  'log'
])

/** Object ids spliced into git arguments must look like object ids. */
const SAFE_SHA = /^[0-9a-f]{40,64}$/iu

const REF_PREFIX = 'refs/dsh-omp-advisor'
const RESTORE_NS = `${REF_PREFIX}/restore`
const ACCEPTED_NS = `${REF_PREFIX}/accepted`
const TRAILER_MARKER = 'dsh-omp-advisor-restore-point:v1'

const SPAWN_ENV = Object.freeze({
  GIT_TERMINAL_PROMPT: '0',
  GIT_OPTIONAL_LOCKS: '0'
})

/** Skip snapshots for repos with more tracked files than this. */
const MAX_TRACKED_FILES = 50_000
/** Hard timeout for any single git invocation (ms). */
const GIT_TIMEOUT_MS = 30_000

export interface GitProbe {
  repo: boolean
  unborn?: boolean
  branch?: string
  head?: string
}

export interface RestorePoint {
  /** Ref tail (timestamp-ms id). */
  id: string
  sha: string
  tree: string
  time: number
  session?: string
  turn?: number
  label?: string
  parent?: string
  /** Short diff-stat vs the previous point (list with withStats only). */
  stat?: string
}

interface GitResult {
  code: number
  stdout: string
  stderr: string
}

/**
 * Run one allowlisted git command with prompts disabled and a hard timeout.
 * Resolves null on timeout/spawn failure so callers degrade instead of throwing.
 */
function git(cwd: string, args: string[], timeoutMs: number = GIT_TIMEOUT_MS): Promise<GitResult | null> {
  const verb = args[0]
  if (!ALLOWED_VERBS.has(verb)) {
    return Promise.resolve(null)
  }
  return new Promise(resolve => {
    let settled = false
    const child = spawn('git', args, {
      cwd,
      env: { ...process.env, ...SPAWN_ENV },
      stdio: ['ignore', 'pipe', 'pipe']
    })
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        child.kill('SIGKILL')
        resolve(null)
      }
    }, timeoutMs)
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => (stdout += String(chunk)))
    child.stderr.on('data', chunk => (stderr += String(chunk)))
    child.on('error', () => {
      if (!settled) {
        settled = true
        clearTimeout(timer)
        resolve(null)
      }
    })
    child.on('close', code => {
      if (!settled) {
        settled = true
        clearTimeout(timer)
        resolve({ code: code ?? 1, stdout, stderr })
      }
    })
  })
}

function assertSafeRef(ref: string): void {
  if (typeof ref !== 'string' || !SAFE_SHA.test(ref)) {
    throw new Error(`restore point ref is not a valid git object id: ${JSON.stringify(ref)}`)
  }
}

/** Session ids become ref path segments — keep them boring. */
function sanitizeForRef(part: string): string {
  return part.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'unknown'
}

const probeCache = new Map<string, GitProbe>()

/** Probe whether cwd is a usable git worktree (cached per process lifetime). */
export async function probeGit(cwd: string): Promise<GitProbe> {
  const cached = probeCache.get(cwd)
  if (cached) return cached
  const inside = await git(cwd, ['rev-parse', '--is-inside-work-tree'])
  if (!inside || inside.code !== 0 || !inside.stdout.trim().startsWith('true')) {
    const probe: GitProbe = { repo: false }
    probeCache.set(cwd, probe)
    return probe
  }
  const branch = await git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'])
  const head = await git(cwd, ['rev-parse', '--verify', 'HEAD'])
  const unborn = !head || head.code !== 0
  const probe: GitProbe = {
    repo: true,
    unborn,
    branch: branch && branch.code === 0 ? branch.stdout.trim() : undefined,
    head: head && head.code === 0 ? head.stdout.trim() : undefined
  }
  probeCache.set(cwd, probe)
  return probe
}

/** Test hook: forget cached probes (a repo can be initialized mid-process). */
export function clearProbeCache(): void {
  probeCache.clear()
}

function freshTempIndexPath(): string {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = join(tmpdir(), `dsh-omp-advisor-index-${randomBytes(8).toString('hex')}`)
    if (!existsSync(candidate)) return candidate
    try {
      unlinkSync(candidate)
    } catch {
      /* try another name */
    }
  }
  return join(tmpdir(), `dsh-omp-advisor-index-${randomBytes(12).toString('hex')}-${Date.now()}`)
}

interface RestoreTrailer {
  v: 1
  session?: string
  turn?: number
  label?: string
  parent?: string
  time: number
}

function encodeTrailer(trailer: RestoreTrailer): string {
  return `${TRAILER_MARKER}\n${JSON.stringify(trailer)}`
}

function decodeTrailer(message: string): RestoreTrailer | null {
  const index = message.indexOf(TRAILER_MARKER)
  if (index < 0) return null
  const jsonLine = message.slice(index + TRAILER_MARKER.length).split('\n').find(line => line.trim().startsWith('{'))
  if (!jsonLine) return null
  try {
    const parsed = JSON.parse(jsonLine) as Partial<RestoreTrailer>
    if (parsed.v !== 1) return null
    return { v: 1, ...parsed, time: typeof parsed.time === 'number' ? parsed.time : 0 }
  } catch {
    return null
  }
}

/**
 * Snapshot the worktree (tracked changes + untracked files, honoring
 * .gitignore) into a commit object under the hidden restore namespace.
 * Never touches the user's index, HEAD, branch, or worktree.
 * Returns null when unavailable (non-git, unborn HEAD, oversized, failure).
 */
export async function createRestorePoint(
  cwd: string,
  opts: { session?: string; turn?: number; label?: string; parentSha?: string }
): Promise<RestorePoint | null> {
  const probe = await probeGit(cwd)
  if (!probe.repo || probe.unborn) return null

  // Size guard: skip oversized repos instead of stalling the tool path.
  const lsFiles = await git(cwd, ['ls-files'])
  if (!lsFiles || lsFiles.code !== 0) return null
  const trackedCount = lsFiles.stdout.split('\n').filter(Boolean).length
  if (trackedCount > MAX_TRACKED_FILES) return null

  const indexPath = freshTempIndexPath()
  const envIdx = { ...process.env, ...SPAWN_ENV, GIT_INDEX_FILE: indexPath }
  const run = (args: string[]) =>
    new Promise<GitResult | null>(resolve => {
      const verb = args[0]
      if (!ALLOWED_VERBS.has(verb)) return resolve(null)
      let settled = false
      const child = spawn('git', args, { cwd, env: envIdx, stdio: ['ignore', 'pipe', 'pipe'] })
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true
          child.kill('SIGKILL')
          resolve(null)
        }
      }, GIT_TIMEOUT_MS)
      let stdout = ''
      let stderr = ''
      child.stdout.on('data', chunk => (stdout += String(chunk)))
      child.stderr.on('data', chunk => (stderr += String(chunk)))
      child.on('error', () => {
        if (!settled) {
          settled = true
          clearTimeout(timer)
          resolve(null)
        }
      })
      child.on('close', code => {
        if (!settled) {
          settled = true
          clearTimeout(timer)
          resolve({ code: code ?? 1, stdout, stderr })
        }
      })
    })

  try {
    const add = await run(['add', '-A', '--', '.'])
    if (!add || add.code !== 0) return null
    const writeTree = await run(['write-tree'])
    if (!writeTree || writeTree.code !== 0) return null
    const tree = writeTree.stdout.trim()
    if (!SAFE_SHA.test(tree)) return null

    // Skip when nothing changed since the parent point.
    if (opts.parentSha && SAFE_SHA.test(opts.parentSha)) {
      const parentTree = await git(cwd, ['log', '-1', '--format=%T', opts.parentSha])
      if (parentTree && parentTree.code === 0 && parentTree.stdout.trim() === tree) return null
    }

    const time = Date.now()
    const id = `${time}-${randomBytes(3).toString('hex')}`
    const trailer = encodeTrailer({
      v: 1,
      session: opts.session,
      turn: opts.turn,
      label: opts.label,
      parent: opts.parentSha,
      time
    })
    const commitArgs = ['commit-tree', tree, '-m', `dsh-omp-advisor restore point\n\n${trailer}`]
    if (opts.parentSha && SAFE_SHA.test(opts.parentSha)) {
      commitArgs.push('-p', opts.parentSha)
    }
    const commit = await git(cwd, commitArgs)
    if (!commit || commit.code !== 0) return null
    const sha = commit.stdout.trim()
    if (!SAFE_SHA.test(sha)) return null

    const ref = `${RESTORE_NS}/${opts.session ? sanitizeForRef(opts.session) : 'shared'}/${id}`
    const update = await git(cwd, ['update-ref', ref, sha])
    if (!update || update.code !== 0) return null

    return { id, sha, tree, time, session: opts.session, turn: opts.turn, label: opts.label, parent: opts.parentSha }
  } finally {
    try {
      if (existsSync(indexPath)) unlinkSync(indexPath)
    } catch {
      /* temp index cleanup is best-effort */
    }
  }
}

/**
 * List restore points (newest first) from the hidden namespace, optionally
 * with a short diff-stat against each point's parent.
 */
export async function listRestorePoints(
  cwd: string,
  sessionId?: string,
  opts?: { withStats?: boolean }
): Promise<RestorePoint[]> {
  const ns = sessionId ? `${RESTORE_NS}/${sanitizeForRef(sessionId)}` : RESTORE_NS
  const refs = await git(cwd, ['for-each-ref', ns, '--format=%(objectname) %(refname)'])
  if (!refs || refs.code !== 0) return []
  const points: RestorePoint[] = []
  for (const line of refs.stdout.split('\n')) {
    const [sha, refname] = line.trim().split(/\s+/)
    if (!sha || !SAFE_SHA.test(sha) || !refname) continue
    const message = await git(cwd, ['log', '-1', '--format=%B', sha])
    if (!message || message.code !== 0) continue
    const trailer = decodeTrailer(message.stdout)
    if (!trailer) continue
    points.push({
      id: refname.slice(refname.lastIndexOf('/') + 1),
      sha,
      tree: '',
      time: trailer.time,
      session: trailer.session,
      turn: trailer.turn,
      label: trailer.label,
      parent: trailer.parent
    })
  }
  // Git's committerdate sort has 1s resolution; sort by the ms trailer time
  // (then the timestamped id) so "newest first" is deterministic.
  points.sort((a, b) => b.time - a.time || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))
  if (opts?.withStats) {
    for (const point of points) {
      if (!point.parent || !SAFE_SHA.test(point.parent)) continue
      const stat = await git(cwd, ['diff', '--stat', point.parent, point.sha])
      if (stat && stat.code === 0) {
        point.stat = stat.stdout.split('\n').slice(0, 40).join('\n').trim()
      }
    }
  }
  return points
}

/** Bounded name-status + stat diff between two restore points. */
export async function diffRestorePoints(cwd: string, a: string, b: string): Promise<string | null> {
  assertSafeRef(a)
  assertSafeRef(b)
  const nameStatus = await git(cwd, ['diff', '--name-status', a, b])
  const stat = await git(cwd, ['diff', '--stat', a, b])
  if (!nameStatus || nameStatus.code !== 0) return null
  const parts = [`### Changed paths\n${nameStatus.stdout.split('\n').slice(0, 200).join('\n').trim()}`]
  if (stat && stat.code === 0) {
    parts.push(`### Stat\n${stat.stdout.split('\n').slice(0, 40).join('\n').trim()}`)
  }
  return parts.join('\n\n')
}

/** Delete oldest restore points beyond the keep cap. Returns removed count. */
export async function pruneRestorePoints(cwd: string, keep: number, sessionId?: string): Promise<number> {
  const points = await listRestorePoints(cwd, sessionId)
  if (points.length <= keep) return 0
  let removed = 0
  for (const point of points.slice(keep)) {
    const ref = `${RESTORE_NS}/${point.session ? sanitizeForRef(point.session) : 'shared'}/${point.id}`
    const result = await git(cwd, ['update-ref', '-d', ref])
    if (result && result.code === 0) removed++
  }
  return removed
}

/**
 * Mark a restore point as the accepted state (completion gate): move its ref
 * into the accepted namespace. The object itself is untouched.
 */
export async function markRestorePointAccepted(cwd: string, point: RestorePoint): Promise<boolean> {
  assertSafeRef(point.sha)
  const target = `${ACCEPTED_NS}/${point.session ? sanitizeForRef(point.session) : 'shared'}/${point.id}`
  const result = await git(cwd, ['update-ref', target, point.sha])
  return result !== null && result.code === 0
}

/** Worktree-only restore recipe handed to the primary model (never run by us). */
export function restoreInstructions(point: RestorePoint): string {
  return [
    `Restore point ${point.id} (commit ${point.sha.slice(0, 12)}${typeof point.turn === 'number' ? `, after turn ${point.turn}` : ''}):`,
    `  git restore --source=${point.sha} --worktree --staged .`,
    'This restores tracked paths and files that existed at the point, without moving HEAD or your branch.',
    'Files created AFTER this point are kept, not deleted — if one of them was the destructive step, remove it deliberately.'
  ].join('\n')
}

/** Commit recipe for the accepted state, addressed to the current branch. */
export function commitInstructions(branch: string | undefined, summary: string): string {
  const target = branch && branch !== 'HEAD' ? branch : 'the current branch'
  return [
    `Commit the accepted state to ${target}:`,
    '  git add -A',
    `  git commit -m ${JSON.stringify(summary)}`,
    'Stage and commit yourself — the advisor never commits for you.'
  ].join('\n')
}
