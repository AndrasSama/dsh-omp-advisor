/**
 * dsh-omp-advisor browser half: registers the "OMP Advisor" settings section.
 * Loaded through package.json `dsh.client` (web platform) and wrapped for the
 * DSH ModuleLoader by build.mjs.
 */
import { createSettingsSection } from './SettingsSection'

export const name = 'dsh-omp-advisor'

export const inject = [
  '@deepseek-ai/dsh-client-runtime',
  '@deepseek-ai/dsh-client-connection',
  '@deepseek-ai/dsh-client-ui-settings',
  '@deepseek-ai/dsh-api-remotes'
]

export function apply(ctx: any): void {
  ctx.effect(
    () =>
      ctx.slots.inject('settings.section', function* () {
        yield ctx.slots.register(
          {
            name: 'settings.section',
            id: 'dsh-omp-advisor',
            order: 13,
            label: () => 'OMP Advisor',
            inject: () => ({})
          },
          createSettingsSection(ctx)
        )
      }),
    'dsh-omp-advisor: settings section'
  )
}
