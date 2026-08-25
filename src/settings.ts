/**
 * The `dsh-omp-advisor` settings namespace: master switch, review trigger,
 * interrupt policy, and the advisor roster. Models are picked from the DSH
 * model list (provider route + model id), stored here, and used verbatim for
 * `ctx.llm.stream` calls.
 */
import z from '@deepseek-ai/schemastery'
import type { AdvisorEntry, AdvisorSettings } from './types'

export const SETTINGS_NAMESPACE = 'dsh-omp-advisor'

const advisorEntrySchema = z.object({
  name: z.string().required().description('Advisor display name (unique within the roster).'),
  provider: z.string().required().description('DSH provider route id, from the model list.'),
  model: z.string().required().description('Model id served by that provider route.'),
  reasoningEffort: z.string().description('Optional adapter-owned reasoning effort for this model.'),
  maxTurns: z
    .number()
    .min(1)
    .max(10)
    .default(4)
    .description('Max advisor tool-loop turns per review (investigation budget).'),
  instructions: z.string().description('Optional specialization appended to the shared advisor baseline.'),
  skills: z
    .array(z.string())
    .default([])
    .description('Packaged skill ids injected into this advisor\'s context (see skills/ in the plugin).'),
  skillMode: z
    .union(['inject', 'lazy'])
    .default('inject')
    .description(
      'inject = embed full skill bodies in the advisor system prompt; lazy = embed id+description only and grant a load_skill tool (saves tokens, costs one extra call per loaded skill).'
    ),
  preset: z.string().description('Id of the built-in preset this advisor was created from (for skill resets).'),
  workspaces: z
    .array(z.string())
    .default([])
    .description(
      'Workspace scoping: substring patterns matched against the session cwd (e.g. "Qwest Chain"). Empty = advisor runs in every session.'
    ),
  enabled: z.boolean().default(true).description('Per-advisor on/off toggle.')
})

export const advisorSettingsSchema = z.object({
  enabled: z.boolean().default(false).description('Master switch: attach advisors to sessions.'),
  reviewTrigger: z
    .union(['step', 'turn'])
    .default('turn')
    .description('Feed transcript deltas to advisors at step boundaries or turn boundaries.'),
  interruptSeverities: z
    .array(z.union(['nit', 'concern', 'blocker']))
    .default(['concern', 'blocker'])
    .description('Severities delivered as steering (nearest step boundary); others ride non-interrupting context.'),
  adviceCoalesceMs: z
    .number()
    .min(0)
    .max(10000)
    .default(0)
    .description(
      '0 = deliver each advice note individually. >0 = collect notes from all advisors for this many ms and deliver them as one batched advisory message (interrupting severities still flush immediately).'
    ),
  autoRetry: z
    .boolean()
    .default(true)
    .description(
      'Automatically retry failed work: failed advisor reviews re-run after the retry delay, and a failed primary-model turn receives an automatic "continue" followup message. Aborts and permanent errors (unknown model/provider) never retry.'
    ),
  autoRetryDelayMs: z
    .number()
    .min(1000)
    .max(300000)
    .default(5000)
    .description('Delay in ms before an auto-retry fires (advisor review retry or primary "continue" message).'),
  autoRetryMax: z
    .number()
    .min(0)
    .max(999)
    .default(3)
    .description(
      'Max auto-retry attempts per failed advisor review, and per primary-model failure episode. 0 = unlimited (permanent errors still never retry).'
    ),
  interveneOnBlocker: z
    .boolean()
    .default(false)
    .description(
      'Escalation: when an advisor raises a blocker while the primary agent is running, cancel the running step (undispatched tool calls are aborted) and wake the agent with the advisory. Off by default — advice stays advice.'
    ),
  minDeltaChars: z
    .number()
    .min(0)
    .max(100000)
    .default(0)
    .description(
      'Skip advisor reviews whose rendered transcript delta is smaller than this many characters (0 = review everything). Skipped deltas are not replayed later.'
    ),
  advisors: z.array(advisorEntrySchema).default([]).description('Advisor roster.')
})

/** Clamp the advice coalesce window to the schema bounds (ms; 0 = off). */
function coerceCoalesceMs(raw: unknown): number {
  const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0
  return Math.min(10000, Math.max(0, Math.round(value)))
}

/** Clamp the auto-retry delay to the schema bounds (ms). */
function coerceAutoRetryDelayMs(raw: unknown): number {
  const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : 5000
  return Math.min(300000, Math.max(1000, Math.round(value)))
}

/** Clamp the auto-retry attempt cap to the schema bounds (0 = unlimited). */
function coerceAutoRetryMax(raw: unknown): number {
  const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : 3
  return Math.min(999, Math.max(0, Math.round(value)))
}

/** Clamp the minimum review delta size to the schema bounds (chars; 0 = off). */
function coerceMinDeltaChars(raw: unknown): number {
  const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0
  return Math.min(100000, Math.max(0, Math.round(value)))
}

/**
 * Workspace scoping match: an advisor with no usable patterns runs everywhere;
 * otherwise one of its patterns must appear inside the session cwd.
 */
export function advisorMatchesWorkspace(entry: Pick<AdvisorEntry, 'workspaces'>, cwd: string): boolean {
  const patterns = (entry.workspaces ?? [])
    .map(pattern => pattern.trim())
    .filter(pattern => pattern !== '')
  if (patterns.length === 0) return true
  return patterns.some(pattern => cwd.includes(pattern))
}

/** Normalize a resolved settings value (defensive; the schema already validates). */
export function normalizeSettings(raw: unknown): AdvisorSettings {
  const value = (raw ?? {}) as Partial<AdvisorSettings>
  const advisors = Array.isArray(value.advisors) ? value.advisors : []
  const seen = new Set<string>()
  const deduped = []
  for (const entry of advisors) {
    if (!entry || typeof entry.name !== 'string' || !entry.name.trim()) continue
    if (typeof entry.provider !== 'string' || !entry.provider.trim()) continue
    if (typeof entry.model !== 'string' || !entry.model.trim()) continue
    const name = entry.name.trim()
    if (seen.has(name)) continue
    seen.add(name)
    deduped.push({
      name,
      provider: entry.provider,
      model: entry.model,
      ...(typeof entry.reasoningEffort === 'string' && entry.reasoningEffort
        ? { reasoningEffort: entry.reasoningEffort }
        : {}),
      maxTurns: Math.min(10, Math.max(1, Math.round(entry.maxTurns || 4))),
      ...(typeof entry.instructions === 'string' && entry.instructions.trim()
        ? { instructions: entry.instructions.trim() }
        : {}),
      ...(Array.isArray(entry.skills)
        ? {
            skills: entry.skills.filter(
              (s): s is string => typeof s === 'string' && s.trim() !== ''
            )
          }
        : {}),
      ...(entry.skillMode === 'lazy' ? { skillMode: 'lazy' as const } : {}),
      ...(typeof entry.preset === 'string' && entry.preset ? { preset: entry.preset } : {}),
      ...(Array.isArray(entry.workspaces)
        ? {
            workspaces: entry.workspaces
              .filter((w): w is string => typeof w === 'string' && w.trim() !== '')
              .map(w => w.trim())
          }
        : {}),
      enabled: entry.enabled !== false
    })
  }
  const severities = Array.isArray(value.interruptSeverities)
    ? value.interruptSeverities.filter((s): s is 'nit' | 'concern' | 'blocker' =>
        s === 'nit' || s === 'concern' || s === 'blocker'
      )
    : (['concern', 'blocker'] as AdvisorSettings['interruptSeverities'])
  return {
    enabled: value.enabled === true,
    reviewTrigger: value.reviewTrigger === 'step' ? 'step' : 'turn',
    interruptSeverities: severities,
    adviceCoalesceMs: coerceCoalesceMs((value as { adviceCoalesceMs?: unknown }).adviceCoalesceMs),
    autoRetry: (value as { autoRetry?: unknown }).autoRetry !== false,
    autoRetryDelayMs: coerceAutoRetryDelayMs((value as { autoRetryDelayMs?: unknown }).autoRetryDelayMs),
    autoRetryMax: coerceAutoRetryMax((value as { autoRetryMax?: unknown }).autoRetryMax),
    interveneOnBlocker: (value as { interveneOnBlocker?: unknown }).interveneOnBlocker === true,
    minDeltaChars: coerceMinDeltaChars((value as { minDeltaChars?: unknown }).minDeltaChars),
    advisors: deduped
  }
}

/**
 * Editor round-trip normalizer: type-coerces like `normalizeSettings` but is
 * NON-destructive — it keeps entries whose name/provider/model is empty (the
 * user may be mid-edit) and does not trim text. The settings section folds
 * the host's reply into the form, so a strict reply would delete the card
 * being edited and yank characters out of focused inputs. The runtime keeps
 * reading through the strict `normalizeSettings`, so an incomplete advisor
 * never actually runs.
 */
export function normalizeSettingsLenient(raw: unknown): AdvisorSettings {
  const value = (raw ?? {}) as Partial<AdvisorSettings>
  const advisors = Array.isArray(value.advisors) ? value.advisors : []
  const preserved: AdvisorEntry[] = []
  for (const entry of advisors) {
    if (!entry || typeof entry !== 'object') continue
    const e = entry as Partial<AdvisorEntry>
    preserved.push({
      name: typeof e.name === 'string' ? e.name : '',
      provider: typeof e.provider === 'string' ? e.provider : '',
      model: typeof e.model === 'string' ? e.model : '',
      ...(typeof e.reasoningEffort === 'string' && e.reasoningEffort
        ? { reasoningEffort: e.reasoningEffort }
        : {}),
      maxTurns: Math.min(10, Math.max(1, Math.round(e.maxTurns || 4))),
      ...(typeof e.instructions === 'string' ? { instructions: e.instructions } : {}),
      ...(Array.isArray(e.skills)
        ? { skills: e.skills.filter((s): s is string => typeof s === 'string') }
        : {}),
      ...(e.skillMode === 'lazy' ? { skillMode: 'lazy' as const } : {}),
      ...(typeof e.preset === 'string' ? { preset: e.preset } : {}),
      ...(Array.isArray(e.workspaces)
        ? { workspaces: e.workspaces.filter((w): w is string => typeof w === 'string') }
        : {}),
      enabled: e.enabled !== false
    })
  }
  const severities = Array.isArray(value.interruptSeverities)
    ? value.interruptSeverities.filter((s): s is 'nit' | 'concern' | 'blocker' =>
        s === 'nit' || s === 'concern' || s === 'blocker'
      )
    : (['concern', 'blocker'] as AdvisorSettings['interruptSeverities'])
  return {
    enabled: value.enabled === true,
    reviewTrigger: value.reviewTrigger === 'step' ? 'step' : 'turn',
    interruptSeverities: severities,
    adviceCoalesceMs: coerceCoalesceMs((value as { adviceCoalesceMs?: unknown }).adviceCoalesceMs),
    autoRetry: (value as { autoRetry?: unknown }).autoRetry !== false,
    autoRetryDelayMs: coerceAutoRetryDelayMs((value as { autoRetryDelayMs?: unknown }).autoRetryDelayMs),
    autoRetryMax: coerceAutoRetryMax((value as { autoRetryMax?: unknown }).autoRetryMax),
    interveneOnBlocker: (value as { interveneOnBlocker?: unknown }).interveneOnBlocker === true,
    minDeltaChars: coerceMinDeltaChars((value as { minDeltaChars?: unknown }).minDeltaChars),
    advisors: preserved
  }
}
