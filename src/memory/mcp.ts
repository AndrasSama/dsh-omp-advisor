/**
 * Minimal MCP client for memory engines (v0.7.0): JSON-RPC 2.0 over stdio
 * (newline-delimited) or streamable HTTP. Deliberately dependency-free —
 * `dsh-mcp-client` is a per-server cordis subplugin, not a callable library,
 * and memory engines need short-lived, timeout-bounded probe/call semantics.
 *
 * Sessions are cached per engine with an idle TTL (spawning a python/stdio
 * server per review would be wasteful); `disposeAllMcpSessions` runs on
 * service shutdown.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import type { MemoryEngineConfig } from '../types'
import { expandHome, resolveEngineSpawn } from './engines'

export const MCP_PROBE_TIMEOUT_MS = 8000
export const MCP_CALL_TIMEOUT_MS = 10000
const MCP_IDLE_TTL_MS = 5 * 60_000
const MCP_PROTOCOL_VERSION = '2024-11-05'

interface PendingRequest {
  resolve(value: unknown): void
  reject(error: Error): void
  timer: ReturnType<typeof setTimeout>
}

export interface McpSession {
  engineId: string
  toolNames: string[]
  call(tool: string, args: Record<string, unknown>, timeoutMs?: number): Promise<string>
  close(): void
}

interface CachedSession {
  session: McpSession
  lastUsed: number
  reaper: ReturnType<typeof setTimeout>
}

const cache = new Map<string, CachedSession>()

function cacheKey(engine: MemoryEngineConfig): string {
  return JSON.stringify({
    id: engine.id,
    transport: engine.transport,
    command: engine.command,
    args: engine.args,
    cwd: engine.cwd,
    url: engine.url,
    resolveScript: engine.resolveScript,
    env: engine.env
  })
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    promise.then(
      value => {
        clearTimeout(timer)
        resolve(value)
      },
      error => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

/** Extract text from an MCP tools/call result payload. */
export function extractMcpText(result: unknown): string {
  const payload = (result ?? {}) as { content?: unknown; isError?: boolean }
  const content = Array.isArray(payload.content) ? payload.content : []
  const text = content
    .filter((block): block is { type: string; text?: unknown } => !!block && (block as { type?: unknown }).type === 'text')
    .map(block => (typeof block.text === 'string' ? block.text : ''))
    .join('\n')
  if (payload.isError === true) throw new Error(text || 'MCP tool returned an error')
  return text
}

/* --------------------------------- stdio ---------------------------------- */

function connectStdio(engine: MemoryEngineConfig): Promise<McpSession> {
  return new Promise((resolve, reject) => {
    if (!engine.command) {
      reject(new Error(`engine "${engine.id}" has no command`))
      return
    }
    const cwd = engine.cwd ? expandHome(engine.cwd) : process.cwd()
    const { command, args } = resolveEngineSpawn(engine)
    let child: ChildProcess
    try {
      child = spawn(command, args, {
        cwd,
        env: { ...process.env, ...(engine.env ?? {}) },
        stdio: ['pipe', 'pipe', 'pipe']
      })
    } catch (error) {
      reject(new Error(`spawn failed: ${String(error instanceof Error ? error.message : error)}`))
      return
    }
    // Cached idle sessions must never hold the process open: unref the child
    // and its pipes so an unused memory server does not block shutdown.
    child.unref?.()
    for (const stream of [child.stdin, child.stdout, child.stderr]) {
      ;(stream as unknown as { unref?(): void } | null)?.unref?.()
    }

    let nextId = 1
    let buffer = ''
    let settled = false
    const pending = new Map<number, PendingRequest>()

    const fail = (message: string): void => {
      if (settled) return
      settled = true
      try {
        child.kill()
      } catch {
        /* already gone */
      }
      reject(new Error(message))
    }

    const send = (message: Record<string, unknown>): void => {
      if (!child.stdin || child.stdin.destroyed) throw new Error('MCP stdio stream closed')
      child.stdin.write(`${JSON.stringify(message)}\n`)
    }

    const request = (method: string, params: unknown, timeoutMs: number): Promise<unknown> => {
      const id = nextId++
      return withTimeout(
        new Promise((res, rej) => {
          pending.set(id, { resolve: res, reject: rej, timer: setTimeout(() => {}, 0) })
          const entry = pending.get(id) as PendingRequest
          clearTimeout(entry.timer)
          entry.timer = setTimeout(() => {
            pending.delete(id)
            rej(new Error(`MCP ${method} timed out after ${timeoutMs}ms`))
          }, timeoutMs)
          try {
            send({ jsonrpc: '2.0', id, method, params })
          } catch (error) {
            pending.delete(id)
            rej(error instanceof Error ? error : new Error(String(error)))
          }
        }),
        timeoutMs + 500,
        `MCP ${method}`
      )
    }

    const handleLine = (line: string): void => {
      let message: { id?: number; result?: unknown; error?: { message?: string } }
      try {
        message = JSON.parse(line)
      } catch {
        return // tolerate non-JSON log noise on stdout
      }
      if (typeof message.id !== 'number') return // notifications
      const entry = pending.get(message.id)
      if (!entry) return
      pending.delete(message.id)
      clearTimeout(entry.timer)
      if (message.error) entry.reject(new Error(message.error.message ?? 'MCP error'))
      else entry.resolve(message.result)
    }

    child.stdout?.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8')
      let newline = buffer.indexOf('\n')
      while (newline >= 0) {
        const line = buffer.slice(0, newline).trim()
        buffer = buffer.slice(newline + 1)
        if (line) handleLine(line)
        newline = buffer.indexOf('\n')
      }
    })
    child.on('error', error => fail(`MCP server error: ${error.message}`))
    child.on('exit', code => {
      for (const entry of pending.values()) {
        clearTimeout(entry.timer)
        entry.reject(new Error(`MCP server exited (${code})`))
      }
      pending.clear()
      fail(`MCP server exited early (${code})`)
    })

    void (async () => {
      try {
        const init = (await request(
          'initialize',
          {
            protocolVersion: MCP_PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: { name: 'dsh-omp-advisor', version: '0.7.0' }
          },
          MCP_PROBE_TIMEOUT_MS
        )) as { protocolVersion?: string } | undefined
        if (!init) throw new Error('no initialize result')
        try {
          send({ jsonrpc: '2.0', method: 'notifications/initialized' })
        } catch {
          /* server may close stdin races; non-fatal */
        }
        const listed = (await request('tools/list', {}, MCP_PROBE_TIMEOUT_MS)) as { tools?: { name?: string }[] }
        const toolNames = (listed?.tools ?? [])
          .map(tool => tool?.name)
          .filter((name): name is string => typeof name === 'string')
        if (settled) return
        settled = true
        resolve({
          engineId: engine.id,
          toolNames,
          async call(tool, args, timeoutMs = MCP_CALL_TIMEOUT_MS) {
            const result = await request('tools/call', { name: tool, arguments: args }, timeoutMs)
            return extractMcpText(result)
          },
          close() {
            for (const entry of pending.values()) {
              clearTimeout(entry.timer)
              entry.reject(new Error('MCP session closed'))
            }
            pending.clear()
            try {
              child.kill()
            } catch {
              /* already gone */
            }
          }
        })
      } catch (error) {
        fail(String(error instanceof Error ? error.message : error))
      }
    })()
  })
}

/* ---------------------------------- http ---------------------------------- */

async function httpRequest(
  url: string,
  message: Record<string, unknown>,
  timeoutMs: number,
  envHeaders: Record<string, string>
): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        ...envHeaders
      },
      body: JSON.stringify(message),
      signal: controller.signal
    })
    const body = await response.text()
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`)
    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('text/event-stream')) {
      // Streamable HTTP: take the first JSON data frame.
      for (const line of body.split('\n')) {
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (!data) continue
        return JSON.parse(data)
      }
      throw new Error('SSE response carried no data frame')
    }
    return JSON.parse(body)
  } finally {
    clearTimeout(timer)
  }
}

async function connectHttp(engine: MemoryEngineConfig): Promise<McpSession> {
  if (!engine.url) throw new Error(`engine "${engine.id}" has no url`)
  const headers: Record<string, string> = {}
  for (const [key, value] of Object.entries(engine.env ?? {})) {
    if (/^header_/i.test(key)) headers[key.replace(/^header_/i, '').toLowerCase()] = value
  }
  let nextId = 1
  const request = async (method: string, params: unknown, timeoutMs: number): Promise<unknown> => {
    const envelope = { jsonrpc: '2.0', id: nextId++, method, params }
    const response = (await httpRequest(engine.url as string, envelope, timeoutMs, headers)) as {
      result?: unknown
      error?: { message?: string }
    }
    if (response.error) throw new Error(response.error.message ?? 'MCP error')
    return response.result
  }
  const init = (await request(
    'initialize',
    {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'dsh-omp-advisor', version: '0.7.0' }
    },
    MCP_PROBE_TIMEOUT_MS
  )) as { protocolVersion?: string } | undefined
  if (!init) throw new Error('no initialize result')
  await httpRequest(
    engine.url,
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    MCP_PROBE_TIMEOUT_MS,
    headers
  ).catch(() => undefined)
  const listed = (await request('tools/list', {}, MCP_PROBE_TIMEOUT_MS)) as { tools?: { name?: string }[] }
  const toolNames = (listed?.tools ?? [])
    .map(tool => tool?.name)
    .filter((name): name is string => typeof name === 'string')
  return {
    engineId: engine.id,
    toolNames,
    async call(tool, args, timeoutMs = MCP_CALL_TIMEOUT_MS) {
      const result = await request('tools/call', { name: tool, arguments: args }, timeoutMs)
      return extractMcpText(result)
    },
    close() {
      /* stateless: nothing to tear down */
    }
  }
}

/* --------------------------------- cache ---------------------------------- */

/** Connect (or reuse a cached session) and return the live MCP session. */
export async function getMcpSession(engine: MemoryEngineConfig): Promise<McpSession> {
  const key = cacheKey(engine)
  const cached = cache.get(key)
  if (cached) {
    cached.lastUsed = Date.now()
    return cached.session
  }
  const session =
    engine.transport === 'http' ? await connectHttp(engine) : await connectStdio(engine)
  const entry: CachedSession = {
    session,
    lastUsed: Date.now(),
    reaper: setTimeout(() => {
      cache.delete(key)
      session.close()
    }, MCP_IDLE_TTL_MS)
  }
  // The idle reaper must not keep the event loop alive on its own.
  ;(entry.reaper as { unref?(): void }).unref?.()
  cache.set(key, entry)
  return session
}

/** Probe an engine: connect + list tools. Returns the tool names. */
export async function probeMcpEngine(engine: MemoryEngineConfig): Promise<string[]> {
  const session = await getMcpSession(engine)
  return session.toolNames
}

/** Close all cached MCP sessions (service shutdown / settings rebuild). */
export function disposeAllMcpSessions(): void {
  for (const [key, entry] of cache) {
    clearTimeout(entry.reaper)
    entry.session.close()
    cache.delete(key)
  }
}
