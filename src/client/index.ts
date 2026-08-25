/**
 * dsh-omp-advisor browser half: registers the "Ward Council" settings section
 * and — when dsh-better-sidebar is installed — an "Advisors" monitor tab in
 * the sidebar workbench (optional runtime probe; see ./sidebar.tsx).
 * Loaded through package.json `dsh.client` (web platform) and wrapped for the
 * DSH ModuleLoader by build.mjs.
 */
import { createSettingsSection } from './SettingsSection'
import { mountAdvisorSidebarTab } from './sidebar'

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
 *
 * `betterSidebar` (dsh-better-sidebar) is deliberately NOT listed: it is an
 * OPTIONAL service, and a missing inject name would strand this whole fiber.
 * sidebar.tsx probes it at runtime instead and no-ops when absent.
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
            // Display name is "Ward Council"; the stable id (and settings
            // namespace) stays dsh-omp-advisor so installs survive rebrands.
            label: () => 'Ward Council',
            inject: () => ({})
          },
          createSettingsSection(ctx)
        )
      }),
    'dsh-omp-advisor: settings section'
  )

  // Optional dsh-better-sidebar monitor tab (runtime probe, never a hard dep).
  mountAdvisorSidebarTab(ctx)
}
