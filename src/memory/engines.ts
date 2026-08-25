/**
 * Memory engine presets and settings normalization (v0.7.0).
 *
 * Presets ship in code; the user's `memory.engines` list holds overrides and
 * custom MCP engines, merged over the presets by id. Availability probing is
 * runtime work (MemoryManager); this module only shapes configuration.
 */
import type { MemoryEngineConfig, MemoryEngineTools, MemorySettings, MemoryWriteGate } from '../types'
import { existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Built-in engine id: per-workspace plaintext markdown lessons. */
export const BUILTIN_MD_ENGINE = 'builtin-md'

/**
 * Builtin-preset schema version. Bump whenever a preset's structural fields
 * (kind/transport/command/args/tools/readOnly/resolveScript) change, so
 * stale persisted copies of the old preset are re-derived from code instead
 * of shadowing the update (see normalizeMemorySettings).
 *   1 → v0.7.0 initial presets
 *   2 → v0.7.2 misakanet dotted tool names; openviking + hindsight switched
 *       from service/http-url to spawnable stdio MCP servers (resolveScript)
 */
export const MEMORY_PRESET_VERSION = 2

/**
 * Preset engine definitions. `builtin-md` always exists; the others are
 * grayed out by the UI when their probe fails (missing server binary,
 * unresolvable script, or a missing tool).
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
    // OpenViking's `openvikingMemory` host service is isolate-scoped (not
    // reachable via ctx.get from another plugin), so we drive the same stdio
    // MCP proxy the plugin itself starts. Unlike the service, the proxy also
    // exposes write tools (remember/write), so this preset can store.
    id: 'openviking',
    label: 'OpenViking',
    kind: 'mcp',
    builtin: true,
    transport: 'stdio',
    command: 'node',
    resolveScript: '@openviking/dsh-memory-plugin/servers/mcp-proxy.mjs',
    tools: { recall: 'find', store: 'remember' },
    readOnly: false,
    enabled: true
  },
  {
    // Hindsight ships a stdio MCP server (dist/mcp-server.js). It requires
    // HINDSIGHT_MCP_HARNESS to identify the calling harness; 'dsh' stamps the
    // DSH bank. recall/store map to its knowledge-page tools.
    id: 'hindsight',
    label: 'Hindsight',
    kind: 'mcp',
    builtin: true,
    transport: 'stdio',
    command: 'node',
    resolveScript: '@vectorize-io/hindsight-coding-agents/dist/mcp-server.js',
    env: { HINDSIGHT_MCP_HARNESS: 'dsh' },
    tools: { recall: 'hindsight_search_knowledge_pages', store: 'hindsight_ingest_document' },
    readOnly: false,
    enabled: true
  },
  {
    // MisakaNet failure-lesson network (read-only by design: it serves
    // verified debugging lessons, it does not accept arbitrary writes). The
    // raw MCP server exposes DOTTED tool names; DSH only rewrites dots to
    // underscores when surfacing tools to agents, so we must match the dots.
    id: 'misakanet',
    label: 'MisakaNet',
    kind: 'mcp',
    builtin: true,
    transport: 'stdio',
    command: 'python3',
    args: ['scripts/mcp_deepseek_adapter.py'],
    cwd: '~/.dsh/plugins/MisakaNet',
    tools: { recall: 'deepseek.recovery.search', health: 'deepseek.recovery.status' },
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
    ...(typeof e.resolveScript === 'string' && e.resolveScript.trim()
      ? { resolveScript: e.resolveScript.trim() }
      : {}),
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
 *
 * Preset-version migration: when the persisted `presetVersion` is older than
 * MEMORY_PRESET_VERSION (or absent — every v0.7.0/0.7.1 install), builtin
 * engines are re-derived from the code presets, carrying over ONLY the user's
 * `enabled` toggle. This stops stale persisted copies of an old preset (e.g.
 * misakanet's pre-fix underscore tool names, openviking's old service kind /
 * readOnly flag) from shadowing an updated preset. Custom (non-preset)
 * engines always pass through untouched.
 */
export function normalizeMemorySettings(raw: unknown): MemorySettings {
  const value = (raw ?? {}) as Partial<MemorySettings>
  const userEngines = Array.isArray(value.engines) ? value.engines : []
  const persistedVersion = Number.isFinite(value.presetVersion) ? (value.presetVersion as number) : 0
  const stale = persistedVersion < MEMORY_PRESET_VERSION

  const byId = new Map<string, MemoryEngineConfig>()
  for (const preset of PRESET_ENGINES) byId.set(preset.id, { ...preset })

  for (const entry of userEngines) {
    const coerced = coerceEngine(entry)
    if (!coerced) continue
    const preset = byId.get(coerced.id)
    if (preset) {
      if (stale) {
        // Migration: keep the fresh preset, carry over only the on/off toggle.
        byId.set(coerced.id, { ...preset, enabled: coerced.enabled !== false })
      } else {
        // Normal merge: user overrides ride over the preset, but the preset
        // keeps its identity (kind/builtin) unless the user replaces the label.
        byId.set(coerced.id, {
          ...preset,
          ...coerced,
          kind: preset.kind,
          builtin: true,
          label: coerced.label ?? preset.label
        })
      }
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
    recallBudgetChars: Math.min(40000, Math.max(500, Math.round(budgetRaw))),
    presetVersion: MEMORY_PRESET_VERSION
  }
}

/** Expand a leading '~' to the user's home directory (engine cwd paths). */
export function expandHome(path: string): string {
  if (path === '~') return process.env.HOME ?? path
  if (path.startsWith('~/')) return `${process.env.HOME ?? '~'}${path.slice(1)}`
  return path
}

/**
 * Candidate node_modules roots for resolving package script specifiers. We
 * search (1) any node_modules enclosing this plugin's own install — the
 * advisor and its sibling memory plugins usually share one — and (2) every
 * DSH profile's node_modules (~/.dsh/profiles/<name>/node_modules), which is
 * where web-profile plugins live even when the advisor runs from elsewhere.
 */
function nodeModulesRoots(): string[] {
  const roots: string[] = []
  try {
    let dir = dirname(fileURLToPath(import.meta.url))
    for (let depth = 0; depth < 10; depth++) {
      const candidate = join(dir, 'node_modules')
      if (existsSync(candidate)) roots.push(candidate)
      const parent = dirname(dir)
      if (parent === dir) break
      dir = parent
    }
  } catch {
    /* import.meta unavailable — fall through to profile roots */
  }
  const home = process.env.HOME
  if (home) {
    const profilesDir = join(home, '.dsh', 'profiles')
    if (existsSync(profilesDir)) {
      try {
        for (const entry of readdirSync(profilesDir)) {
          roots.push(join(profilesDir, entry, 'node_modules'))
        }
      } catch {
        /* unreadable profiles dir */
      }
    }
  }
  return roots
}

/**
 * Resolve a Node package-relative script specifier (e.g.
 * '@openviking/dsh-memory-plugin/servers/mcp-proxy.mjs') to an absolute path
 * by searching known node_modules roots. Returns undefined when not found.
 */
export function resolvePackageScript(specifier: string): string | undefined {
  if (!specifier) return undefined
  for (const root of nodeModulesRoots()) {
    const candidate = join(root, specifier)
    if (existsSync(candidate)) return candidate
  }
  return undefined
}

/**
 * Compute the spawn-ready command + args for an engine: `node` maps to the
 * running Node binary (process.execPath), and a `resolveScript` specifier is
 * resolved to an absolute path and prepended to the args. Callers should have
 * already verified resolution (probeEngine) before spawning.
 */
export function resolveEngineSpawn(engine: MemoryEngineConfig): { command: string; args: string[] } {
  let command = engine.command ?? ''
  if (command === 'node') command = process.execPath
  let args = [...(engine.args ?? [])]
  if (engine.resolveScript) {
    const resolved = resolvePackageScript(engine.resolveScript)
    if (resolved) args = [resolved, ...args]
  }
  return { command, args }
}
