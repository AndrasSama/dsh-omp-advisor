/**
 * The advisor's own agent loop, built directly on `ctx.llm.stream` with
 * DSH-configured provider routes. One loop instance per configured advisor
 * per watched session: it keeps an append-only conversation, reviews each
 * transcript delta, may investigate with read-only tools, and reports
 * through the `advise` tool.
 *
 * Ported semantics (oh-my-pi, MIT): incremental updates, per-update advise
 * budget, quarantine before dispatch, context-loss recovery without
 * replaying the primary transcript.
 */
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ADVISE_TOOL_SCHEMA, AdviseGate, type AdviceMeta } from './advise-tool'
import { buildAdvisorQuarantineSourceText, quarantineAdvisorUnsafeOutput } from './quarantine'
import {
  ADVISOR_TOOL_SCHEMAS,
  DEFAULT_ADVISOR_TOOL_NAMES,
  LOAD_SKILL_TOOL_SCHEMA,
  RESTORE_POINT_TOOL_SCHEMAS,
  executeAdvisorTool
} from './tools'
import {
  commitInstructions,
  listRestorePoints,
  markRestorePointAccepted,
  probeGit,
  restoreInstructions
} from './restore-points'
import type { AdvisorEntry, AdvisorSeverity, LlmContentBlock, LlmLike, LlmStreamChunk } from './types'
import systemPrompt from './prompts/system.md'
import adviseToolPrompt from './prompts/advise-tool.md'
import completionGatePrompt from './prompts/completion-gate.md'
import contextFilesTemplate from './prompts/context-files.md'
import { PACKAGED_SKILLS } from './skills.generated'

/** Soft character budget for the advisor's own conversation before a reset. */
const CONTEXT_CHAR_BUDGET = 400_000
/** Context file names probed in the watched workspace (first match wins each). */
const CONTEXT_FILE_NAMES = ['AGENTS.md', 'CLAUDE.md', '.cursorrules']

export interface AdvisorLoopHost {
  llm: LlmLike
  /** Absolute working directory of the watched session. */
  cwd: string
  /** Session id scoping the restore-point ring. */
  sessionId?: string
  /** Grant the restore-point tools (list/diff) to this advisor. */
  restorePointsEnabled?: boolean
  /** Include the completion-gate protocol in the system prompt. */
  completionGate?: boolean
  /** Called for every accepted advice note. */
  onAdvice(note: string, severity: AdvisorSeverity | undefined, advisorName: string, meta?: AdviceMeta): void
  log?(message: string, meta?: Record<string, unknown>): void
}

interface LoopMessage {
  id: string
  role: 'user' | 'assistant'
  content: LlmContentBlock[]
  source: Record<string, unknown>
}

function userMessage(text: string): LoopMessage {
  return {
    id: randomUUID(),
    role: 'user',
    content: [{ type: 'text', text }],
    source: { kind: 'plugin', plugin: 'dsh-omp-advisor' }
  }
}

function assistantMessage(blocks: LlmContentBlock[], provider: string, model: string): LoopMessage {
  return {
    id: randomUUID(),
    role: 'assistant',
    content: blocks,
    source: { kind: 'model', provider, model }
  }
}

function toolResultMessage(callId: string, text: string, isError: boolean): LoopMessage {
  return {
    id: randomUUID(),
    role: 'user',
    content: [{ type: 'tool-result', toolCallId: callId, content: [{ type: 'text', text }], isError }],
    source: { kind: 'tool', callId }
  }
}

async function loadContextFiles(cwd: string): Promise<{ path: string; content: string }[]> {
  const found: { path: string; content: string }[] = []
  for (const name of CONTEXT_FILE_NAMES) {
    try {
      const content = await readFile(join(cwd, name), 'utf8')
      if (content.trim()) found.push({ path: name, content: content.slice(0, 20_000) })
    } catch {
      /* absent context file is normal */
    }
  }
  return found
}

function renderContextFiles(files: { path: string; content: string }[]): string {
  if (files.length === 0) return ''
  const body = files
    .map(file => `<file path="${file.path}">\n${file.content}\n</file>`)
    .join('\n')
  return contextFilesTemplate.replace('{{#each contextFiles}}', '').replace('{{/each}}', body)
}

/** Assemble one advisor turn from the stream, collecting finished blocks. */
async function collectStream(stream: AsyncIterable<LlmStreamChunk>): Promise<{
  blocks: LlmContentBlock[]
  finishKind: string
  failure?: { message: string; code: string }
}> {
  const blocks: LlmContentBlock[] = []
  let finishKind = 'stop'
  let failure: { message: string; code: string } | undefined
  for await (const chunk of stream) {
    if (chunk.type === 'block-end') {
      blocks.push(chunk.block)
    } else if (chunk.type === 'finish') {
      finishKind = chunk.reason.kind
      if (chunk.reason.kind === 'error' || chunk.reason.kind === 'aborted') {
        failure = chunk.reason.failure
      }
    }
  }
  return { blocks, finishKind, failure }
}

export class AdvisorLoop {
  private messages: LoopMessage[] = []
  private contextFilesLoaded = false
  private contextFilesText = ''
  private charSize = 0
  readonly gate: AdviseGate

  constructor(
    private readonly host: AdvisorLoopHost,
    private entry: AdvisorEntry
  ) {
    this.gate = new AdviseGate((note, severity, meta) => host.onAdvice(note, severity, entry.name, meta))
  }

  get advisorName(): string {
    return this.entry.name
  }

  /** Replace the entry when settings change (model, maxTurns, instructions). */
  updateEntry(entry: AdvisorEntry): void {
    this.entry = entry
  }

  /** Refresh host flags that settings changes may invalidate (restore points, completion gate). */
  updateHostFlags(flags: Partial<Pick<AdvisorLoopHost, 'sessionId' | 'restorePointsEnabled' | 'completionGate'>>): void {
    Object.assign(this.host, flags)
  }

  /** Drop the advisor's conversation (context loss / settings rebuild). The session cursor is owned by the runtime and stays. */
  resetConversation(): void {
    this.messages = []
    this.charSize = 0
    this.contextFilesLoaded = false
    this.gate.resetDeliveredNotes()
  }

  private skillsText(): string {
    const ids = this.entry.skills ?? []
    if (ids.length === 0) return ''
    const lazy = this.entry.skillMode === 'lazy'
    const bodies: string[] = []
    for (const id of ids) {
      const skill = PACKAGED_SKILLS[id]
      if (!skill) continue // unknown ids are skipped, never fatal
      if (lazy) {
        bodies.push(`<skill name="${skill.id}">${skill.description}</skill>`)
      } else {
        bodies.push(`<skill name="${skill.id}">\n${skill.body}\n</skill>`)
      }
    }
    if (bodies.length === 0) return ''
    const header = lazy
      ? 'Curated skills are available on demand. The index below lists id + purpose; call `load_skill` with a skill id to read its full guidance before relying on it.'
      : undefined
    return header ? `<skills>\n${header}\n${bodies.join('\n')}\n</skills>` : `<skills>\n${bodies.join('\n')}\n</skills>`
  }

  private systemText(): string {
    const parts = [systemPrompt.trim()]
    if (this.contextFilesText) parts.push(this.contextFilesText)
    parts.push(`Tool reference for \`advise\`:\n${adviseToolPrompt.trim()}`)
    if (this.host.completionGate !== false) parts.push(completionGatePrompt.trim())
    if (this.entry.instructions?.trim()) {
      parts.push(`<specialization>\n${this.entry.instructions.trim()}\n</specialization>`)
    }
    const skills = this.skillsText()
    if (skills) parts.push(skills)
    return parts.join('\n\n')
  }

  private trackSize(text: string): void {
    this.charSize += text.length
  }

  private maybeResetForContext(): void {
    if (this.charSize <= CONTEXT_CHAR_BUDGET) return
    this.host.log?.('advisor context reset (budget)', { advisor: this.entry.name })
    this.resetConversation()
  }

  /**
   * Review one transcript delta. Runs the tool loop until the advisor calls
   * `advise`, stops calling tools, or exhausts `maxTurns`.
   *
   * @returns true when the turn completed (even silently); throws on model failure.
   */
  async review(deltaText: string, opts: { inProgress: boolean; signal: AbortSignal }): Promise<boolean> {
    if (!this.contextFilesLoaded) {
      this.contextFilesLoaded = true
      this.contextFilesText = renderContextFiles(await loadContextFiles(this.host.cwd))
    }

    this.maybeResetForContext()
    this.gate.beginUpdate(opts.inProgress)

    this.messages.push(userMessage(deltaText))
    this.trackSize(deltaText)

    const toolSchemas = [
      ...ADVISOR_TOOL_SCHEMAS,
      ...(this.entry.skillMode === 'lazy' ? [LOAD_SKILL_TOOL_SCHEMA] : []),
      ...(this.host.restorePointsEnabled ? [...RESTORE_POINT_TOOL_SCHEMAS] : []),
      ADVISE_TOOL_SCHEMA
    ] as { name: string; description: string; parameters: Record<string, unknown> }[]

    const maxTurns = Math.max(1, this.entry.maxTurns || 4)
    let advised = false

    for (let turn = 0; turn < maxTurns; turn++) {
      if (opts.signal.aborted) return false

      const request = {
        provider: this.entry.provider,
        model: this.entry.model,
        ...(this.entry.reasoningEffort ? { reasoningEffort: this.entry.reasoningEffort } : {}),
        messages: this.messages as unknown[],
        system: this.systemText(),
        tools: toolSchemas,
        signal: opts.signal
      }

      const { blocks, failure } = await collectStream(this.host.llm.stream(request))
      if (failure) {
        // Roll back the failed turn's user delta so a retry does not replay it twice.
        this.messages.pop()
        throw new Error(`advisor model failure (${failure.code}): ${failure.message}`)
      }
      if (blocks.length === 0) {
        this.messages.pop()
        throw new Error('advisor model returned no content')
      }

      // Quarantine before anything becomes model-visible history.
      const sourceText = buildAdvisorQuarantineSourceText(deltaText, [])
      const quarantine = quarantineAdvisorUnsafeOutput(blocks, DEFAULT_ADVISOR_TOOL_NAMES, sourceText)
      if (quarantine) {
        this.messages.push(assistantMessage([{ type: 'text', text: quarantine }], this.entry.provider, this.entry.model))
        throw new Error(quarantine)
      }

      this.messages.push(assistantMessage(blocks, this.entry.provider, this.entry.model))
      this.trackSize(JSON.stringify(blocks))

      const toolCalls = blocks.filter((b): b is Extract<LlmContentBlock, { type: 'tool-call' }> => b.type === 'tool-call')
      if (toolCalls.length === 0) return true // silent review or plain text: done

      let producedAdvice = false
      for (const call of toolCalls) {
        if (call.name === 'advise') {
          let args: { note?: unknown; severity?: unknown; rewindTo?: unknown; acceptance?: unknown } = {}
          try {
            args = JSON.parse(call.arguments)
          } catch {
            /* handled below */
          }
          if (typeof args.note !== 'string' || !args.note.trim()) {
            this.messages.push(toolResultMessage(call.id, 'advise requires a non-empty note string.', true))
            continue
          }
          const severity =
            args.severity === 'concern' || args.severity === 'blocker' || args.severity === 'nit'
              ? args.severity
              : undefined

          // Optional structured extras (validated; invalid values are rejected
          // back to the advisor instead of delivered half-formed).
          let meta: AdviceMeta | undefined
          if (typeof args.rewindTo === 'string' && args.rewindTo.trim()) {
            const points = await listRestorePoints(this.host.cwd, this.host.sessionId)
            const target = points.find(point => point.id === args.rewindTo || point.sha.startsWith(String(args.rewindTo)))
            if (!target) {
              this.messages.push(
                toolResultMessage(
                  call.id,
                  `unknown restore point "${String(args.rewindTo)}" — call list_restore_points for valid ids and resubmit.`,
                  true
                )
              )
              continue
            }
            if (!/do not repeat/i.test(args.note) || !/keep/i.test(args.note)) {
              this.messages.push(
                toolResultMessage(
                  call.id,
                  'A rewind advisory must classify the steps: include a "Do not repeat:" section (the destructive/wrong steps) and a "Keep (progress):" section (steps worth preserving). Resubmit with both.',
                  true
                )
              )
              continue
            }
            meta = { ...(meta ?? {}), rewindTo: { id: target.id, sha: target.sha, turn: target.turn } }
          }
          if (args.acceptance === 'completed' || args.acceptance === 'compromise-accepted') {
            meta = { ...(meta ?? {}), acceptance: args.acceptance }
            const points = await listRestorePoints(this.host.cwd, this.host.sessionId)
            if (points.length > 0) {
              await markRestorePointAccepted(this.host.cwd, points[0]).catch(() => false)
            }
            const probe = await probeGit(this.host.cwd)
            const summary = args.note.trim().split('\n')[0].slice(0, 120)
            meta.commitHint = commitInstructions(probe.branch, summary)
          }

          const result = this.gate.advise(args.note, severity, meta)
          if (result.delivered || result.deferred) producedAdvice = true
          this.messages.push(toolResultMessage(call.id, result.modelReply, false))
          continue
        }
        if (!DEFAULT_ADVISOR_TOOL_NAMES.has(call.name)) {
          this.messages.push(toolResultMessage(call.id, `Tool not available: ${call.name}`, true))
          continue
        }
        const result = await executeAdvisorTool({ cwd: this.host.cwd, sessionId: this.host.sessionId }, call.name, call.arguments)
        this.messages.push(toolResultMessage(call.id, result.text, result.isError === true))
        this.trackSize(result.text)
      }
      if (producedAdvice) advised = true
      // Per oh-my-pi: max one advise per update — stop the loop once delivered.
      if (producedAdvice) return true
    }

    return advised || true
  }
}
