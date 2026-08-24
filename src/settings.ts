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
  preset: z.string().description('Id of the built-in preset this advisor was created from (for skill resets).'),
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
  advisors: z.array(advisorEntrySchema).default([]).description('Advisor roster.')
})

/** Clamp the advice coalesce window to the schema bounds (ms; 0 = off). */
function coerceCoalesceMs(raw: unknown): number {
  const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0
  return Math.min(10000, Math.max(0, Math.round(value)))
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
      ...(typeof entry.preset === 'string' && entry.preset ? { preset: entry.preset } : {}),
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
      ...(typeof e.preset === 'string' ? { preset: e.preset } : {}),
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
    advisors: preserved
  }
}
