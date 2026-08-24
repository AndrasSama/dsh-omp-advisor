/**
 * dsh-omp-advisor browser half: registers the "OMP Advisor" settings section.
 * Loaded through package.json `dsh.client` (web platform) and wrapped for the
 * DSH ModuleLoader by build.mjs.
 */
import { createSettingsSection } from './SettingsSection'

export const name = 'dsh-omp-advisor'

/**
 * Cordis SERVICE names this module consumes (NOT package names — those belong
 * in package.json `dsh.client.inject`, the module-graph layer). The browser
 * fiber waits until each name is provided in the client root context:
 *   slots      ← dsh-client-runtime (SlotRegistry)
 *   connection ← dsh-client-connection. Settings reads/writes ride the
 *              plugin's own RPC channel, NOT ctx.settingsScope: settingsScope
 *              persistence is loopback-only in DSH, so from remote browsers
 *              its snapshot is permanently `unavailable` and would hide the
 *              whole section.
 * Exporting package names here strands the fiber pending forever.
 */
export const inject = ['slots', 'connection']

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
