/**
 * The settings binding, version-adaptive.
 *
 * DSH 0.1.x exposed `settings.register(ns, schema, options)` and handed the
 * plugin back a live scope backed by the profile settings document. 0.2 removed
 * that plugin-facing API — the service is `SettingsForms` now, and a Loader
 * entry's `Config` fields ARE its settings. The Loader validates that config
 * against the schema this package exports (`Config` in src/index.ts) and passes
 * the resolved, schema-defaulted value to `apply(ctx, config)`; edits go through
 * `settings.update(ns, patch, expectedRevision?)`, which merges the patch into
 * the entry's config in the profile patch.
 *
 * A config edit goes through `fiber.update()` → the `internal/update` waterfall
 * → `restart()`, so the plugin is disposed and re-applied with the new config.
 * The replacement service therefore reads the new value; this adapter still
 * commits the patch locally so the writing service keeps answering correctly
 * until the restart lands, and the service re-attaches to live sessions lazily
 * (`onSessionEvent` -> `attach`).
 *
 * Both lines are supported: `createSettingsScope` uses the registered scope when
 * the host exposes `register`, and otherwise binds to the entry config.
 */
import { SETTINGS_NAMESPACE, advisorSettingsSchema, normalizeSettings } from './settings'
import type { AdvisorSettings, CordisContextLike, SettingsScopeLike } from './types'

/** The 0.2 profile settings service (SettingsForms), narrowed to what we use. */
interface SettingsFormsLike {
  update?(ns: string, patch: object, expectedRevision?: number): Promise<void>
  replace?(ns: string, section: object, expectedRevision?: number): Promise<void>
}

/**
 * Mirror of the validation the 0.1.x registered scope ran inside its `validate`
 * option, kept so both bindings share one definition.
 *
 * Note the reach: `normalizeSettings` already DROPS an advisor without a
 * name/provider/model, so this loop cannot fire for those. It is a defensive
 * restatement of the contract, not the gate that keeps a partial roster out of
 * the document — that job belongs to `normalizeSettings` itself, and the lenient
 * view the editor returns exists precisely so a half-typed card can be saved.
 */
export function assertAdvisorsRunnable(raw: unknown): void {
  const value = normalizeSettings(raw)
  for (const entry of value.advisors) {
    if (!entry.provider || !entry.model) {
      throw new Error(`advisor "${entry.name}" needs both provider and model from the model list`)
    }
  }
}

/** Bind to the Loader entry's config (DSH 0.2+: settings ARE the Config). */
function createConfigScope(hostCtx: CordisContextLike, config: unknown): SettingsScopeLike<AdvisorSettings> {
  let current = config as AdvisorSettings
  const settings = hostCtx.settings as SettingsFormsLike
  return {
    get: () => current,
    // Nothing to watch: an edit restarts the plugin, so a freshly constructed
    // service reads the new value instead of this one being mutated in place.
    watch: () => () => {},
    update: async (patch: object) => {
      if (typeof settings.update !== 'function') {
        hostCtx.logger?.warn?.(
          `${SETTINGS_NAMESPACE}: settings.update is unavailable — the change is live but was not persisted`
        )
      } else {
        await settings.update(SETTINGS_NAMESPACE, patch)
      }
      current = { ...(current as object), ...patch } as AdvisorSettings
    },
    replace: async (section: object) => {
      if (typeof settings.replace === 'function') await settings.replace(SETTINGS_NAMESPACE, section)
      current = { ...(current as object), ...section } as AdvisorSettings
    }
  }
}

/**
 * Pick the host's settings binding: the 0.1.x registered scope when available,
 * otherwise the 0.2 entry-config scope.
 */
export function createSettingsScope(
  hostCtx: CordisContextLike,
  config: unknown
): SettingsScopeLike<AdvisorSettings> {
  const register = hostCtx.settings?.register
  if (typeof register === 'function') {
    return register.call(hostCtx.settings, SETTINGS_NAMESPACE, advisorSettingsSchema, {
      applies: 'live',
      validate: assertAdvisorsRunnable
    })
  }
  return createConfigScope(hostCtx, config)
}
