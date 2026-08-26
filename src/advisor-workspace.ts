/**
 * Pure, dependency-free workspace-scoped advisor array operations.
 *
 * Shared by the browser half (client/sidebar.tsx), the host service
 * (service.ts atomic workspace writes), and the unit tests. Kept free of any
 * host/node import so it bundles cleanly into the client bundle, can be
 * imported by the host, and can be re-exported by test/entry.ts.
 *
 * Model (v0.7.6): two orthogonal pattern lists per advisor.
 *  - `workspaces`          INCLUSION: empty/absent = runs everywhere; otherwise
 *                          one pattern must match the cwd.
 *  - `disabledWorkspaces`  EXCLUSION: if any pattern matches the cwd the advisor
 *                          does NOT run there, overriding inclusion. This is what
 *                          the sidebar's workspace-scoped "Disable here" writes,
 *                          so an always-on advisor can be switched off in a single
 *                          workspace without touching the global `enabled` switch
 *                          or deleting authored inclusion patterns.
 * Pattern rules mirror the host's `advisorMatchesWorkspace` (settings.ts): a
 * `=x` pattern is an exact match; a bare pattern is a substring.
 *
 * The ops are GENERIC over any advisor shape carrying the four workspace fields
 * (`WorkspaceAdvisorLike`), so the host's closed `AdvisorEntry` and the client's
 * index-signed `WorkspaceAdvisorEntry` both flow through without a cast. Every
 * op returns a NEW array and spreads the untouched entries, so fields the caller
 * does not know about (provider/model/instructions/skills/…) survive a
 * round-trip write back through the settings channel.
 */

/** The four workspace fields the ops read/write; all other fields pass through. */
export interface WorkspaceAdvisorLike {
  name?: string
  enabled?: boolean
  workspaces?: string[]
  disabledWorkspaces?: string[]
}

/** Client-facing advisor shape: the core fields plus a pass-through index signature. */
export interface WorkspaceAdvisorEntry extends WorkspaceAdvisorLike {
  [key: string]: unknown
}

/** Why an advisor is not active in the scoped workspace. */
export type InactiveReason = 'off' | 'disabled-here' | 'not-in-workspace'

/** One advisor preset (id/name/soul/skills) — structurally typed so this module
 * stays import-free; callers pass the matching preset object from presets.ts. */
export interface WorkspaceAdvisorPreset {
  id: string
  name: string
  soul: string
  skills: string[]
}

/** True when a single pattern matches the workspace path. */
export function workspacePatternMatches(pattern: string, cwd: string | undefined): boolean {
  const trimmed = pattern.trim()
  if (trimmed === '') return false
  if (!cwd) return false
  return trimmed.startsWith('=') ? cwd === trimmed.slice(1).trim() : cwd.includes(trimmed)
}

/** True when the pattern list matches the workspace (empty/absent = everywhere). */
export function advisorMatchesWorkspacePatterns(
  workspaces: string[] | undefined,
  cwd: string | undefined
): boolean {
  const list = (workspaces ?? []).map(pattern => pattern.trim()).filter(pattern => pattern !== '')
  if (list.length === 0) return true
  if (!cwd) return false
  return list.some(pattern => workspacePatternMatches(pattern, cwd))
}

/** True when the exclusion list bars the advisor from this workspace. */
export function advisorDisabledInWorkspace(
  entry: WorkspaceAdvisorLike,
  cwd: string | undefined
): boolean {
  const list = (entry.disabledWorkspaces ?? []).map(pattern => pattern.trim()).filter(p => p !== '')
  if (list.length === 0) return false
  if (!cwd) return false
  return list.some(pattern => workspacePatternMatches(pattern, cwd))
}

/** True when the advisor is active in the workspace (on + included + not excluded). */
export function advisorActiveInWorkspace(entry: WorkspaceAdvisorLike, cwd: string | undefined): boolean {
  if (entry.enabled === false) return false
  if (!advisorMatchesWorkspacePatterns(entry.workspaces, cwd)) return false
  return !advisorDisabledInWorkspace(entry, cwd)
}

export interface WorkspaceSplit<T extends WorkspaceAdvisorLike = WorkspaceAdvisorEntry> {
  active: T[]
  inactive: { entry: T; reason: InactiveReason }[]
}

/** Partition the configured advisors into active-here vs not-active-here. */
export function splitAdvisorsByWorkspace<T extends WorkspaceAdvisorLike>(
  advisors: T[],
  cwd: string | undefined
): WorkspaceSplit<T> {
  const active: T[] = []
  const inactive: { entry: T; reason: InactiveReason }[] = []
  for (const entry of advisors) {
    if (entry.enabled === false) {
      inactive.push({ entry, reason: 'off' })
    } else if (advisorDisabledInWorkspace(entry, cwd)) {
      inactive.push({ entry, reason: 'disabled-here' })
    } else if (!advisorMatchesWorkspacePatterns(entry.workspaces, cwd)) {
      inactive.push({ entry, reason: 'not-in-workspace' })
    } else {
      active.push(entry)
    }
  }
  return { active, inactive }
}

/**
 * Make the named advisor watch this workspace (workspace-scoped enable):
 *  - turn its master switch on,
 *  - clear any exclusion that matches this workspace,
 *  - and, if its inclusion list is non-empty and does not already match, append
 *    an exact `=<cwd>` pattern (an empty list already matches everywhere).
 * Never touches another advisor, and never removes authored inclusion patterns.
 */
export function enableAdvisorHere<T extends WorkspaceAdvisorLike>(
  advisors: T[],
  name: string,
  cwd: string | undefined
): T[] {
  if (!cwd) return advisors
  return advisors.map(entry => {
    if (entry.name !== name) return entry
    const next: T = { ...entry, enabled: true }
    const disabled = entry.disabledWorkspaces ?? []
    const remainingDisabled = disabled.filter(pattern => !workspacePatternMatches(pattern, cwd))
    if (remainingDisabled.length !== disabled.length) {
      next.disabledWorkspaces = remainingDisabled
    }
    if (!advisorMatchesWorkspacePatterns(entry.workspaces, cwd)) {
      next.workspaces = [...(entry.workspaces ?? []), `=${cwd}`]
    }
    return next
  })
}

/**
 * Stop the named advisor watching this workspace (workspace-scoped disable):
 * append an exact `=<cwd>` exclusion. This is orthogonal to authored config — it
 * never flips the global `enabled` switch and never deletes inclusion patterns,
 * so the advisor keeps running everywhere else and "Enable here" fully restores
 * it. Idempotent: disabling an already-excluded advisor is a no-op.
 */
export function disableAdvisorHere<T extends WorkspaceAdvisorLike>(
  advisors: T[],
  name: string,
  cwd: string | undefined
): T[] {
  if (!cwd) return advisors
  return advisors.map(entry => {
    if (entry.name !== name) return entry
    if (advisorDisabledInWorkspace(entry, cwd)) return entry
    return { ...entry, disabledWorkspaces: [...(entry.disabledWorkspaces ?? []), `=${cwd}`] }
  })
}

export interface BuildWorkspaceAdvisorOptions {
  name: string
  provider: string
  model: string
  cwd?: string
  preset?: WorkspaceAdvisorPreset
}

/** Build one new advisor entry scoped to the workspace (optionally from a preset). */
export function buildWorkspaceAdvisor(options: BuildWorkspaceAdvisorOptions): WorkspaceAdvisorEntry {
  const { name, provider, model, cwd, preset } = options
  return {
    name,
    provider,
    model,
    maxTurns: 4,
    enabled: true,
    ...(typeof cwd === 'string' && cwd !== '' ? { workspaces: [`=${cwd}`] } : {}),
    ...(preset
      ? { instructions: preset.soul, skills: [...preset.skills], preset: preset.id }
      : {})
  }
}

/** Pick a unique advisor name given the existing names (mirrors the settings tab). */
export function uniqueAdvisorName(base: string, existing: WorkspaceAdvisorLike[]): string {
  const taken = new Set(existing.map(entry => entry.name))
  if (!taken.has(base)) return base
  let suffix = 2
  let candidate = `${base} ${suffix}`
  while (taken.has(candidate)) candidate = `${base} ${++suffix}`
  return candidate
}
