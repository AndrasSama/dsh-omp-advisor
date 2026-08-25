/**
 * Memory engine presets and settings normalization (v0.7.0).
 *
 * Presets ship in code; the user's `memory.engines` list holds overrides and
 * custom MCP engines, merged over the presets by id. Availability probing is
 * runtime work (MemoryManager); this module only shapes configuration.
 */
import type { MemoryEngineConfig, MemoryEngineTools, MemorySettings, MemoryWriteGate } from '../types'

/** Built-in engine id: per-workspace plaintext markdown lessons. */
export const BUILTIN_MD_ENGINE = 'builtin-md'

/**
 * Preset engine definitions. `builtin-md` always exists; the others are
 * grayed out by the UI when their probe fails (missing service, endpoint,
 * or server binary).
 */
export const PRESET_ENGINES: MemoryEngineConfig[] = [
  {
    id: BUILTIN_MD_ENGINE,
    label: 'Plaintext MD (built-in)',
    kind: 'builtin-md',
    builtin: true,
    readOnly: false,
    enabled: true
  },
  {
    // Recall through the isolated `openvikingMemory` host service (search API).
    // The service exposes no write endpoint, so the preset is recall-only;
    // add OpenViking as a custom MCP engine for store support.
    id: 'openviking',
    label: 'OpenViking',
    kind: 'service',
    builtin: true,
    readOnly: true,
    enabled: true
  },
  {
    // Hindsight exposes no DSH host service; users point this preset at a
    // Hindsight MCP endpoint (transport/url or command) via the Memory tab.
    id: 'hindsight',
    label: 'Hindsight',
    kind: 'mcp',
    builtin: true,
    transport: 'http',
    tools: { recall: 'hindsight_search_knowledge_pages', store: 'hindsight_ingest_document' },
    readOnly: false,
    enabled: true
  },
  {
    // MisakaNet failure-lesson network (read-only by design: it serves
    // verified debugging lessons, it does not accept arbitrary writes).
    id: 'misakanet',
    label: 'MisakaNet',
    kind: 'mcp',
    builtin: true,
    transport: 'stdio',
    command: 'python3',
    args: ['scripts/mcp_deepseek_adapter.py'],
    cwd: '~/.dsh/plugins/MisakaNet',
    tools: { recall: 'deepseek_recovery_search', health: 'deepseek_recovery_status' },
    readOnly: true,
    enabled: true
  },
  {
    // mem0 (self-hosted). Ships disabled: it needs a reachable mem0 MCP
    // server; fill the endpoint in the Memory tab and enable it.
    id: 'mem0',
    label: 'mem0',
    kind: 'mcp',
    builtin: true,
    transport: 'http',
    tools: { recall: 'search', store: 'add' },
    readOnly: false,
    enabled: false
  }
]

function coerceWriteGate(raw: unknown): MemoryWriteGate {
  return raw === 'auto' || raw === 'readonly' ? raw : 'approval'
}

function coerceEngine(raw: unknown): MemoryEngineConfig | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const e = raw as Partial<MemoryEngineConfig>
  if (typeof e.id !== 'string' || !e.id.trim()) return undefined
  const id = e.id.trim().toLowerCase().replace(/[^a-z0-9-_]+/g, '-').slice(0, 64)
  if (!id) return undefined
  const kind = e.kind === 'mcp' || e.kind === 'service' ? e.kind : e.kind === 'builtin-md' ? 'builtin-md' : 'mcp'
  const tools = (e.tools ?? {}) as Partial<MemoryEngineTools>
  const env: Record<string, string> = {}
  if (e.env && typeof e.env === 'object') {
    for (const [key, value] of Object.entries(e.env)) {
      if (typeof value === 'string') env[key] = value
    }
  }
  return {
    id,
    ...(typeof e.label === 'string' && e.label.trim() ? { label: e.label.trim() } : {}),
    kind,
    ...(e.builtin === true ? { builtin: true } : {}),
    ...(e.transport === 'stdio' || e.transport === 'http' ? { transport: e.transport } : {}),
    ...(typeof e.command === 'string' && e.command.trim() ? { command: e.command.trim() } : {}),
    ...(Array.isArray(e.args)
      ? { args: e.args.filter((a): a is string => typeof a === 'string') }
      : {}),
    ...(typeof e.cwd === 'string' && e.cwd.trim() ? { cwd: e.cwd.trim() } : {}),
    ...(Object.keys(env).length > 0 ? { env } : {}),
    ...(typeof e.url === 'string' && e.url.trim() ? { url: e.url.trim() } : {}),
    ...(typeof tools.recall === 'string' || typeof tools.store === 'string' ||
    typeof tools.forget === 'string' || typeof tools.health === 'string'
      ? {
          tools: {
            ...(typeof tools.recall === 'string' && tools.recall.trim() ? { recall: tools.recall.trim() } : {}),
            ...(typeof tools.store === 'string' && tools.store.trim() ? { store: tools.store.trim() } : {}),
            ...(typeof tools.forget === 'string' && tools.forget.trim() ? { forget: tools.forget.trim() } : {}),
            ...(typeof tools.health === 'string' && tools.health.trim() ? { health: tools.health.trim() } : {})
          }
        }
      : {}),
    ...(e.readOnly === true ? { readOnly: true } : {}),
    enabled: e.enabled !== false
  }
}

/**
 * Merge user engine entries over the presets (user wins by id), dedupe ids,
 * and clamp the budgets. `builtin-md` can never be removed — a missing or
 * disabled user entry just toggles it.
 */
export function normalizeMemorySettings(raw: unknown): MemorySettings {
  const value = (raw ?? {}) as Partial<MemorySettings>
  const userEngines = Array.isArray(value.engines) ? value.engines : []
  const byId = new Map<string, MemoryEngineConfig>()
  for (const preset of PRESET_ENGINES) byId.set(preset.id, { ...preset })
  for (const entry of userEngines) {
    const coerced = coerceEngine(entry)
    if (!coerced) continue
    const preset = byId.get(coerced.id)
    if (preset) {
      // Override keeps preset identity (kind/label/builtin) unless the user
      // supplies replacements; endpoint fields merge over the preset's.
      byId.set(coerced.id, {
        ...preset,
        ...coerced,
        kind: preset.kind,
        builtin: true,
        label: coerced.label ?? preset.label
      })
    } else {
      byId.set(coerced.id, coerced)
    }
  }
  const perEngineRaw = Number.isFinite(value.recallMaxPerEngine) ? (value.recallMaxPerEngine as number) : 3
  const budgetRaw = Number.isFinite(value.recallBudgetChars) ? (value.recallBudgetChars as number) : 6000
  return {
    enabled: value.enabled !== false,
    writeGate: coerceWriteGate(value.writeGate),
    engines: [...byId.values()],
    recallMaxPerEngine: Math.min(10, Math.max(1, Math.round(perEngineRaw))),
    recallBudgetChars: Math.min(40000, Math.max(500, Math.round(budgetRaw)))
  }
}

/** Expand a leading '~' to the user's home directory (engine cwd paths). */
export function expandHome(path: string): string {
  if (path === '~') return process.env.HOME ?? path
  if (path.startsWith('~/')) return `${process.env.HOME ?? '~'}${path.slice(1)}`
  return path
}
