/**
 * The `dsh-omp-advisor` settings namespace: master switch, review trigger,
 * interrupt policy, and the advisor roster. Models are picked from the DSH
 * model list (provider route + model id), stored here, and used verbatim for
 * `ctx.llm.stream` calls.
 */
import z from '@deepseek-ai/schemastery'
import type { AdvisorSettings } from './types'

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
  advisors: z.array(advisorEntrySchema).default([]).description('Advisor roster.')
})

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
    advisors: deduped
  }
}
