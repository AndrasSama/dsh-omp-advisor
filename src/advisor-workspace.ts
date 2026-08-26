/**
 * Pure, dependency-free workspace-scoped advisor array operations.
 *
 * Shared by the browser half (client/sidebar.tsx) and the unit tests. Kept free
 * of any host/node import so it bundles cleanly into the client bundle and can
 * be re-exported by test/entry.ts.
 *
 * An advisor is "active in a workspace" iff its master switch is on AND its
 * `workspaces` patterns match the workspace `cwd`. Pattern rules mirror the
 * host's `advisorMatchesWorkspace` (settings.ts): an empty/absent list matches
 * everywhere; a `=x` pattern is an exact match; a bare pattern is a substring.
 *
 * Every op returns a NEW array and spreads the untouched entries, so fields the
 * caller does not know about (provider/model/instructions/skills/…) survive a
 * round-trip write back through the `update` RPC.
 */

/** Minimal advisor shape these ops reason about; all other fields pass through. */
export interface WorkspaceAdvisorEntry {
  name?: string
  enabled?: boolean
  workspaces?: string[]
  [key: string]: unknown
}

/** Why an advisor is not active in the scoped workspace. */
export type InactiveReason = 'off' | 'not-in-workspace'

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

/** True when the advisor is active in the workspace (master switch on + matches). */
export function advisorActiveInWorkspace(entry: WorkspaceAdvisorEntry, cwd: string | undefined): boolean {
  return entry.enabled !== false && advisorMatchesWorkspacePatterns(entry.workspaces, cwd)
}

export interface WorkspaceSplit {
  active: WorkspaceAdvisorEntry[]
  inactive: { entry: WorkspaceAdvisorEntry; reason: InactiveReason }[]
}

/** Partition the configured advisors into active-here vs not-active-here. */
export function splitAdvisorsByWorkspace(
  advisors: WorkspaceAdvisorEntry[],
  cwd: string | undefined
): WorkspaceSplit {
  const active: WorkspaceAdvisorEntry[] = []
  const inactive: { entry: WorkspaceAdvisorEntry; reason: InactiveReason }[] = []
  for (const entry of advisors) {
    if (entry.enabled !== false && advisorMatchesWorkspacePatterns(entry.workspaces, cwd)) {
      active.push(entry)
    } else {
      inactive.push({ entry, reason: entry.enabled === false ? 'off' : 'not-in-workspace' })
    }
  }
  return { active, inactive }
}

/**
 * Make the named advisor watch this workspace: turn its master switch on and, if
 * its pattern list is non-empty and does not already match, append an exact
 * `=<cwd>` pattern. An empty list already matches everywhere, so nothing is added.
 */
export function enableAdvisorHere(
  advisors: WorkspaceAdvisorEntry[],
  name: string,
  cwd: string | undefined
): WorkspaceAdvisorEntry[] {
  return advisors.map(entry => {
    if (entry.name !== name) return entry
    const matches = advisorMatchesWorkspacePatterns(entry.workspaces, cwd)
    const shouldAppend = !matches && typeof cwd === 'string' && cwd !== ''
    return {
      ...entry,
      enabled: true,
      ...(shouldAppend ? { workspaces: [...(entry.workspaces ?? []), `=${cwd}`] } : {})
    }
  })
}

/**
 * Stop the named advisor watching this workspace. When its pattern list is empty
 * (active everywhere) or every pattern matches this workspace, a single workspace
 * cannot be excluded, so the master switch is turned off instead. Otherwise the
 * matching patterns are removed and the advisor stays on for its other workspaces.
 */
export function disableAdvisorHere(
  advisors: WorkspaceAdvisorEntry[],
  name: string,
  cwd: string | undefined
): WorkspaceAdvisorEntry[] {
  return advisors.map(entry => {
    if (entry.name !== name) return entry
    const list = entry.workspaces ?? []
    if (list.length === 0) {
      // Active everywhere: the only representable "off here" is a global off.
      return { ...entry, enabled: false }
    }
    const remaining = list.filter(pattern => !workspacePatternMatches(pattern, cwd))
    if (remaining.length === 0) {
      // Was only active here: an emptied list would mean "everywhere", so go off.
      return { ...entry, enabled: false }
    }
    return { ...entry, workspaces: remaining }
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
export function uniqueAdvisorName(base: string, existing: WorkspaceAdvisorEntry[]): string {
  const taken = new Set(existing.map(entry => entry.name))
  if (!taken.has(base)) return base
  let suffix = 2
  let candidate = `${base} ${suffix}`
  while (taken.has(candidate)) candidate = `${base} ${++suffix}`
  return candidate
}
