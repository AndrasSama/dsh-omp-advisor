/**
 * dsh-omp-advisor — oh-my-pi's advisor subsystem ported to DeepSeek Harness.
 *
 * Host bundle entry: provides the AdvisorService (settings namespace
 * `dsh-omp-advisor`, session advisor runtimes, `/dsh-omp-advisor` RPC).
 * The browser half (settings section) ships via package.json `dsh.client`.
 *
 * Advisor semantics ported from can1357/oh-my-pi (MIT license — see
 * NOTICE-oh-my-pi-LICENSE in the repository root).
 */
import { AdvisorService } from './service'
import { advisorSettingsSchema } from './settings'

/** Stable Cordis plugin identity. */
export const name = 'dsh-omp-advisor'

export const inject = ['settings', 'agents', 'llm']

/** Composition config schema (base layer under the user settings document). */
export const Config = advisorSettingsSchema

export function apply(ctx: unknown, config: unknown): void {
  // The service registers itself: settings namespace, session listeners, RPC.
  new AdvisorService(ctx as never, config)
}

export { AdvisorService } from './service'
export { SETTINGS_NAMESPACE, advisorSettingsSchema, normalizeSettings } from './settings'
export { SessionAdvisorRuntime } from './runtime'
export { AdviseGate, ADVISE_TOOL_SCHEMA } from './advise-tool'
export { formatAdvisorBatchContent, resolveDeliveryChannel } from './delivery'
export { quarantineAdvisorUnsafeOutput, AdvisorOutputQuarantinedError } from './quarantine'
export { renderDelta } from './delta'
