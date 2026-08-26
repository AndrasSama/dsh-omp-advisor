/**
 * MemoryManager (v0.7.0): owns engine probing, multi-engine recall (through
 * the single pack layer), and the write gate. Owned by AdvisorService; the
 * per-session runtimes reach it through their host hooks.
 */
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  MemoryEngineConfig,
  MemoryEngineStatusView,
  MemoryItem,
  MemorySettings,
  PendingMemoryWrite
} from '../types'
import { BUILTIN_MD_ENGINE, expandHome, resolvePackageScript } from './engines'
import { appendLesson, MEMORY_DIR_NAME, recallFromWorkspace } from './md-store'
import { getMcpSession, probeMcpEngine } from './mcp'
import { packMemoryItems, renderMemoryBlock } from './pack'

const ENGINE_RECALL_TIMEOUT_MS = 10000
const PENDING_FILE_NAME = 'pending-memory.json'
/** Pending writes kept across all workspaces (monitor shows the union). */
const PENDING_LIMIT = 100

/** Concise title for a stored lesson (backends that take a `title` field). */
function lessonTitle(lesson: { text: string; advisor: string }): string {
  const firstLine = (lesson.text.split('\n').find(line => line.trim() !== '') ?? '').trim()
  const snippet = firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine
  return snippet || `${lesson.advisor} lesson`
}

/**
 * Build the store-tool argument shape for an engine. Each memory backend has
 * its own schema, so a single generic payload fails validation:
 *  - OpenViking `remember` wants `{ messages: [{ role, content }] }`
 *  - Hindsight `hindsight_ingest_document` wants `{ title, content }`
 *  - mem0 `add` wants `{ messages: [{ role, content }] }`
 * Unknown/custom engines get a broad best-effort payload. Matched primarily on
 * the store tool name (the schema determinant), with the engine id as a hint.
 */
export function buildStoreArgs(
  engine: MemoryEngineConfig,
  lesson: { text: string; advisor: string; tags: string[] }
): Record<string, unknown> {
  const tool = engine.tools?.store ?? ''
  if (tool === 'remember' || engine.id === 'openviking') {
    return { messages: [{ role: 'user', content: lesson.text }] }
  }
  if (tool === 'hindsight_ingest_document' || tool === 'ingest_document' || engine.id === 'hindsight') {
    return { title: lessonTitle(lesson), content: lesson.text }
  }
  if (tool === 'add' || engine.id === 'mem0') {
    return { messages: [{ role: 'user', content: lesson.text }] }
  }
  return { content: lesson.text, text: lesson.text, title: lessonTitle(lesson), tags: lesson.tags }
}

interface EngineProbe {
  available: boolean
  detail?: string
}

export interface MemoryManagerHost {
  /** Sanctioned optional service lookup (host-side ctx.get). */
  getService(name: string): unknown
  log?(message: string, meta?: Record<string, unknown>): void
  recordEvent?(kind: string, fields?: { advisor?: string; sessionId?: string; detail?: string }): void
}

export class MemoryManager {
  private settings: MemorySettings
  private probes = new Map<string, EngineProbe>()
  private pending: PendingMemoryWrite[] = []
  /** cwds whose pending file was already folded into `pending` this run. */
  private loadedCwds = new Set<string>()

  constructor(
    private readonly host: MemoryManagerHost,
    settings: MemorySettings
  ) {
    this.settings = settings
  }

  /** Refresh configuration (settings watcher). Keeps probes; rescan re-runs them. */
  updateSettings(settings: MemorySettings): void {
    this.settings = settings
  }

  get memorySettings(): MemorySettings {
    return this.settings
  }

  /* -------------------------------- probing -------------------------------- */

  private async probeEngine(engine: MemoryEngineConfig): Promise<EngineProbe> {
    if (engine.kind === 'builtin-md') {
      return { available: true, detail: 'per-workspace lessons.md' }
    }
    if (engine.id === 'openviking' && engine.kind === 'service') {
      const service = this.host.getService('openvikingMemory')
      if (!service) return { available: false, detail: 'openvikingMemory service not found (plugin not installed?)' }
      const client = (service as { client?: { fetchJSON?: unknown } }).client
      if (!client || typeof client.fetchJSON !== 'function') {
        return { available: false, detail: 'openvikingMemory service has no HTTP client (version mismatch?)' }
      }
      return { available: true, detail: 'openvikingMemory service (recall-only)' }
    }
    // MCP engines need an endpoint before anything else.
    if (engine.transport === 'http' && !engine.url) {
      return { available: false, detail: 'needs setup: no url configured' }
    }
    if (engine.transport !== 'http' && !engine.command) {
      return { available: false, detail: 'needs setup: no command configured' }
    }
    if (engine.resolveScript && !resolvePackageScript(engine.resolveScript)) {
      return { available: false, detail: `not installed: ${engine.resolveScript} not found` }
    }
    if (engine.cwd && !existsSync(expandHome(engine.cwd))) {
      return { available: false, detail: `not installed: ${engine.cwd} missing` }
    }
    try {
      const toolNames = await probeMcpEngine(engine)
      const wanted = [engine.tools?.recall, engine.tools?.store].filter((t): t is string => !!t)
      const missing = wanted.filter(tool => !toolNames.includes(tool))
      if (missing.length > 0) {
        return { available: false, detail: `needs setup: missing tool${missing.length === 1 ? '' : 's'} ${missing.join(', ')}` }
      }
      return { available: true, detail: `${toolNames.length} tools` }
    } catch (error) {
      return { available: false, detail: String(error instanceof Error ? error.message : error).slice(0, 160) }
    }
  }

  /** Re-probe every configured engine. Safe to call repeatedly (Rescan). */
  async probeAll(): Promise<void> {
    if (!this.settings.enabled) return
    const probes = await Promise.all(
      this.settings.engines.map(async engine => [engine.id, await this.probeEngine(engine)] as const)
    )
    this.probes = new Map(probes)
  }

  private probeFor(id: string): EngineProbe {
    return this.probes.get(id) ?? { available: false, detail: 'not probed yet' }
  }

  /**
   * Availability for engine selection. The built-in MD store needs no external
   * service, so it is usable even before (or without) a probe pass; every
   * other engine must have probed available.
   */
  private isAvailable(engine: MemoryEngineConfig): boolean {
    if (engine.kind === 'builtin-md') return true
    return this.probeFor(engine.id).available
  }

  private usableEngines(ids: string[] | undefined): MemoryEngineConfig[] {
    if (!this.settings.enabled) return []
    const wanted = ids && ids.length > 0 ? new Set(ids) : undefined
    return this.settings.engines.filter(engine => {
      if (engine.enabled === false) return false
      if (wanted && !wanted.has(engine.id)) return false
      return this.isAvailable(engine)
    })
  }

  /* -------------------------------- recall --------------------------------- */

  private async recallOpenViking(engine: MemoryEngineConfig, query: string, limit: number): Promise<MemoryItem[]> {
    const service = this.host.getService('openvikingMemory') as {
      client?: { fetchJSON(path: string, init?: unknown): Promise<{ ok?: boolean; result?: unknown }> }
    }
    const client = service?.client
    if (!client?.fetchJSON) return []
    const response = await client.fetchJSON('/api/v1/search/find', {
      method: 'POST',
      body: JSON.stringify({ query, limit, score_threshold: 0 })
    })
    if (!response?.ok || !response.result || typeof response.result !== 'object') return []
    const items: MemoryItem[] = []
    for (const value of Object.values(response.result as Record<string, unknown>)) {
      if (!Array.isArray(value)) continue
      for (const [index, raw] of value.entries()) {
        const item = (raw ?? {}) as { uri?: unknown; abstract?: unknown; content?: unknown; score?: unknown }
        const text =
          typeof item.abstract === 'string' && item.abstract
            ? item.abstract
            : typeof item.content === 'string'
              ? item.content
              : ''
        if (!text.trim()) continue
        items.push({
          engineId: engine.id,
          id: typeof item.uri === 'string' ? item.uri : `ov:${index}`,
          score: typeof item.score === 'number' ? item.score : 0,
          text: text.trim()
        })
      }
    }
    return items.slice(0, limit * 2)
  }

  /** Parse an MCP recall tool's text answer into normalized items. */
  static parseMcpRecallText(engineId: string, text: string, limit: number): MemoryItem[] {
    const trimmed = text.trim()
    if (!trimmed) return []
    let parsed: unknown
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      return [{ engineId, id: `${engineId}:raw`, score: 0, text: trimmed }]
    }
    const list: unknown[] = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object'
        ? ((['results', 'items', 'memories', 'lessons', 'matches'] as const)
            .map(key => (parsed as Record<string, unknown>)[key])
            .find(value => Array.isArray(value)) as unknown[] | undefined) ?? []
        : []
    return list.slice(0, limit * 2).map((raw, index) => {
      const item = (raw ?? {}) as Record<string, unknown>
      const textValue =
        typeof item.text === 'string'
          ? item.text
          : typeof item.content === 'string'
            ? item.content
            : typeof item.summary === 'string'
              ? item.summary
              : typeof item.title === 'string'
                ? item.title
                : JSON.stringify(raw)
      return {
        engineId,
        id:
          typeof item.id === 'string'
            ? item.id
            : typeof item.uri === 'string'
              ? item.uri
              : typeof item.path === 'string'
                ? item.path
                : `${engineId}:${index}`,
        score: typeof item.score === 'number' ? item.score : 0,
        text: textValue
      }
    })
  }

  private async recallMcp(engine: MemoryEngineConfig, query: string, limit: number): Promise<MemoryItem[]> {
    const tool = engine.tools?.recall
    if (!tool) return []
    const session = await getMcpSession(engine)
    const text = await session.call(tool, { query, limit, top: limit }, ENGINE_RECALL_TIMEOUT_MS)
    return MemoryManager.parseMcpRecallText(engine.id, text, limit)
  }

  /**
   * Recall for one advisor review: query every enabled ∧ available ∧ selected
   * engine in parallel with a hard per-engine timeout, then merge through the
   * single pack layer. Returns '' when nothing recalled (or memory is off).
   */
  async recall(opts: {
    cwd: string
    engineIds: string[] | undefined
    query: string
  }): Promise<string> {
    if (!this.settings.enabled || !opts.query.trim()) return ''
    const engines = this.usableEngines(opts.engineIds)
    if (engines.length === 0) return ''
    const perEngine = this.settings.recallMaxPerEngine
    const settled = await Promise.all(
      engines.map(async engine => {
        try {
          const items = await Promise.race([
            engine.kind === 'builtin-md'
              ? recallFromWorkspace(opts.cwd, opts.query, perEngine)
              : engine.id === 'openviking' && engine.kind === 'service'
                ? this.recallOpenViking(engine, opts.query, perEngine)
                : this.recallMcp(engine, opts.query, perEngine),
            new Promise<MemoryItem[]>((_, reject) =>
              setTimeout(() => reject(new Error('recall timeout')), ENGINE_RECALL_TIMEOUT_MS)
            )
          ])
          return items
        } catch (error) {
          this.host.log?.('memory recall failed', {
            engine: engine.id,
            error: String(error instanceof Error ? error.message : error)
          })
          return []
        }
      })
    )
    const packed = packMemoryItems(settled.flat(), {
      perEngineCap: perEngine,
      budgetChars: this.settings.recallBudgetChars
    })
    return renderMemoryBlock(packed)
  }

  /* ------------------------------- write gate ------------------------------- */

  private writableEngines(ids: string[] | undefined): MemoryEngineConfig[] {
    return this.usableEngines(ids).filter(engine => engine.readOnly !== true)
  }

  private async writeNow(
    cwd: string,
    lesson: { text: string; advisor: string; tags: string[] },
    engineIds: string[] | undefined
  ): Promise<{ stored: string[]; failed: string[] }> {
    const stored: string[] = []
    const failed: string[] = []
    for (const engine of this.writableEngines(engineIds)) {
      try {
        if (engine.kind === 'builtin-md') {
          const result = await appendLesson(cwd, lesson)
          if (result.appended) stored.push(engine.id)
          else failed.push(`${engine.id} (${result.reason})`)
          continue
        }
        const tool = engine.tools?.store
        if (!tool) {
          failed.push(`${engine.id} (no store tool)`)
          continue
        }
        const session = await getMcpSession(engine)
        await session.call(tool, buildStoreArgs(engine, lesson), ENGINE_RECALL_TIMEOUT_MS)
        stored.push(engine.id)
      } catch (error) {
        failed.push(`${engine.id} (${String(error instanceof Error ? error.message : error).slice(0, 80)})`)
      }
    }
    return { stored, failed }
  }

  private pendingPath(cwd: string): string {
    return join(cwd, MEMORY_DIR_NAME, PENDING_FILE_NAME)
  }

  private async persistPending(cwd: string): Promise<void> {
    try {
      const forCwd = this.pending.filter(write => (write as PendingMemoryWrite & { cwd?: string }).cwd === cwd)
      await mkdir(join(cwd, MEMORY_DIR_NAME), { recursive: true })
      await writeFile(this.pendingPath(cwd), JSON.stringify(forCwd, null, 2), 'utf8')
    } catch (error) {
      this.host.log?.('pending memory persist failed', {
        cwd,
        error: String(error instanceof Error ? error.message : error)
      })
    }
  }

  /** Fold a workspace's persisted pending writes into the live list (attach). */
  async loadPending(cwd: string): Promise<void> {
    if (!cwd || this.loadedCwds.has(cwd)) return
    this.loadedCwds.add(cwd)
    try {
      const raw = JSON.parse(await readFile(this.pendingPath(cwd), 'utf8'))
      if (!Array.isArray(raw)) return
      for (const entry of raw) {
        if (!entry || typeof entry.id !== 'string' || typeof entry.text !== 'string') continue
        if (this.pending.some(write => write.id === entry.id)) continue
        this.pending.push({ ...(entry as PendingMemoryWrite), cwd } as never)
      }
      if (this.pending.length > PENDING_LIMIT) this.pending.splice(0, this.pending.length - PENDING_LIMIT)
    } catch {
      /* no pending file yet (or unreadable — ignored by design) */
    }
  }

  /**
   * Route one advisor-proposed lesson through the write gate.
   * Returns a short outcome label for logging/events.
   */
  async store(opts: {
    sessionId: string
    cwd: string
    advisor: string
    text: string
    tags: string[]
    engineIds: string[] | undefined
  }): Promise<string> {
    const text = opts.text.trim()
    if (!text || !this.settings.enabled) return 'ignored'
    const gate = this.settings.writeGate
    if (gate === 'readonly') return 'dropped (read-only)'
    if (gate === 'auto') {
      const { stored, failed } = await this.writeNow(opts.cwd, opts, opts.engineIds)
      this.host.recordEvent?.('memory-write', {
        advisor: opts.advisor,
        detail: `auto · ${stored.join(', ') || 'none'}${failed.length ? ` · failed: ${failed.join('; ')}` : ''}`
      })
      return `stored (${stored.join(', ') || 'none'})`
    }
    // approval gate: queue it for the monitor surfaces.
    const write = {
      id: randomUUID(),
      time: Date.now(),
      sessionId: opts.sessionId,
      advisor: opts.advisor,
      text,
      tags: opts.tags,
      engines: this.writableEngines(opts.engineIds).map(engine => engine.id),
      cwd: opts.cwd
    } as PendingMemoryWrite & { cwd: string }
    this.pending.push(write)
    if (this.pending.length > PENDING_LIMIT) this.pending.shift()
    await this.persistPending(opts.cwd)
    this.host.recordEvent?.('memory-pending', {
      advisor: opts.advisor,
      detail: `${text.slice(0, 60)}${text.length > 60 ? '…' : ''}`
    })
    return 'queued for approval'
  }

  /** Approve one pending write (monitor surfaces). */
  async approve(writeId: string): Promise<{ ok: boolean; detail?: string }> {
    const index = this.pending.findIndex(write => write.id === writeId)
    if (index < 0) return { ok: false, detail: 'unknown write id' }
    const write = this.pending[index] as PendingMemoryWrite & { cwd?: string }
    this.pending.splice(index, 1)
    if (write.cwd) await this.persistPending(write.cwd)
    const { stored, failed } = await this.writeNow(write.cwd ?? process.cwd(), write, write.engines)
    this.host.recordEvent?.('memory-write', { advisor: write.advisor, detail: `approved · ${stored.join(', ') || 'none'}` })
    return { ok: true, detail: `stored: ${stored.join(', ') || 'none'}${failed.length ? ` · failed: ${failed.join('; ')}` : ''}` }
  }

  /** Discard one pending write (monitor surfaces). */
  async discard(writeId: string): Promise<{ ok: boolean }> {
    const index = this.pending.findIndex(write => write.id === writeId)
    if (index < 0) return { ok: false }
    const write = this.pending[index] as PendingMemoryWrite & { cwd?: string }
    this.pending.splice(index, 1)
    if (write.cwd) await this.persistPending(write.cwd)
    this.host.recordEvent?.('memory-discard', { advisor: write.advisor })
    return { ok: true }
  }

  /* --------------------------------- views ---------------------------------- */

  pendingWrites(): PendingMemoryWrite[] {
    return [...this.pending].reverse()
  }

  /** Monitor/settings view: merged engine status + gate + pending list. */
  view(): {
    enabled: boolean
    writeGate: string
    engines: MemoryEngineStatusView[]
    pending: PendingMemoryWrite[]
  } {
    return {
      enabled: this.settings.enabled,
      writeGate: this.settings.writeGate,
      engines: this.settings.engines.map(engine => {
        const probe = this.probeFor(engine.id)
        return {
          id: engine.id,
          label: engine.label ?? engine.id,
          kind: engine.kind,
          builtin: engine.builtin === true,
          readOnly: engine.readOnly === true,
          enabled: engine.enabled !== false,
          available: probe.available,
          ...(probe.detail ? { detail: probe.detail } : {})
        }
      }),
      pending: this.pendingWrites()
    }
  }

  /** Default engine set for advisors without an explicit selection. */
  static defaultEngineIds(): string[] {
    return [BUILTIN_MD_ENGINE]
  }
}
