// src/service.ts
import { Service } from "@deepseek-ai/cordis";
import { createUserMessage } from "@deepseek-ai/dsh-llm";

// src/rpc.ts
var RPC_CHANNEL = "/dsh-omp-advisor";
function record(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}
function string(value, label) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label} must be a non-empty string`);
  return value;
}
function registerAdvisorRpc(ctx, service) {
  const connection = ctx.connection;
  if (!connection) return () => {
  };
  return connection.rpc.handle(RPC_CHANNEL, async (endpoint, rawPayload) => {
    const payload = rawPayload === void 0 || rawPayload === null ? {} : record(rawPayload, "payload");
    switch (endpoint) {
      case "snapshot": {
        if (typeof payload.sessionId === "string" && payload.sessionId) {
          return service.snapshot(payload.sessionId);
        }
        return {
          sessions: service.activeSessions().map((sessionId) => service.snapshot(sessionId)),
          settings: service.settings
        };
      }
      case "pause":
      case "resume": {
        const sessionId = string(payload.sessionId, "payload.sessionId");
        const advisor = string(payload.advisor, "payload.advisor");
        return { ok: service.setPaused(sessionId, advisor, endpoint === "pause") };
      }
      case "reviewNow": {
        const sessionId = string(payload.sessionId, "payload.sessionId");
        return { ok: service.reviewNow(sessionId) };
      }
      default:
        throw new Error(`unknown endpoint: ${endpoint}`);
    }
  });
}

// src/advisor-loop.ts
import { randomUUID } from "node:crypto";
import { readFile as readFile2 } from "node:fs/promises";
import { join as join2 } from "node:path";

// src/advise-tool.ts
var SEVERITY_RANK = { nit: 1, concern: 2, blocker: 3 };
function severityRank(severity) {
  return SEVERITY_RANK[severity ?? "nit"];
}
function dedupeKey(note) {
  return note.trim().replace(/\s+/g, " ");
}
var AdviseGate = class {
  constructor(onAdvice) {
    this.onAdvice = onAdvice;
  }
  /** Highest delivered severity rank per normalized note. */
  deliveredRanks = /* @__PURE__ */ new Map();
  inProgressUpdate = false;
  deferredNotes = [];
  /**
   * Mark whether the next advisor prompt reviews an in-progress primary turn.
   * Non-blockers are withheld until a completed update so partial work does
   * not interrupt the primary before it can finish its planned steps.
   */
  beginUpdate(inProgress) {
    const wasInProgress = this.inProgressUpdate;
    this.inProgressUpdate = inProgress;
    if (wasInProgress && !inProgress && this.deferredNotes.length > 0) {
      const pending = this.deferredNotes;
      this.deferredNotes = [];
      for (const item of pending) this.deliver(item.note, item.severity);
    }
  }
  /** Clear delivered-note memory when the advisor starts a fresh conversation. */
  resetDeliveredNotes() {
    this.deliveredRanks.clear();
    this.inProgressUpdate = false;
    this.deferredNotes = [];
  }
  /** Number of notes withheld for the in-flight primary turn. */
  get deferredCount() {
    return this.deferredNotes.length;
  }
  /** Run one advise call through deferral + dedupe. */
  advise(note, severity) {
    if (this.inProgressUpdate && severity !== "blocker") {
      const key = dedupeKey(note);
      const pending = this.deferredNotes.find((item) => item.key === key);
      if (!pending) {
        this.deferredNotes.push({ key, note, severity });
      } else if (severityRank(severity) > severityRank(pending.severity)) {
        pending.severity = severity;
      }
      return {
        modelReply: "Deferred \u2014 primary is mid-turn; this note will be delivered automatically when the turn completes. Do not re-raise the same point.",
        delivered: false,
        deferred: true
      };
    }
    const delivered = this.deliver(note, severity);
    return {
      modelReply: delivered ? "Recorded." : "Duplicate advice ignored.",
      delivered,
      deferred: false
    };
  }
  /** Escalation-rank dedupe; returns true when the note was delivered. */
  deliver(note, severity) {
    const key = dedupeKey(note);
    const rank = severityRank(severity);
    const previousRank = this.deliveredRanks.get(key) ?? 0;
    if (rank <= previousRank) return false;
    this.deliveredRanks.set(key, rank);
    this.onAdvice(note, severity);
    return true;
  }
};
var ADVISE_TOOL_SCHEMA = {
  name: "advise",
  description: "Watched agent: send 1 concrete, terse advice.\nUse sparingly; stay silent when nothing matters.\nCall to avert likely-wrong or materially wasteful work.",
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["note"],
    properties: {
      note: {
        type: "string",
        description: "One concrete piece of advice for the agent you are watching. Terse, specific, actionable."
      },
      severity: {
        type: "string",
        enum: ["nit", "concern", "blocker"],
        description: "How strongly to weigh this. Omit for a plain nit."
      }
    }
  }
};

// src/quarantine.ts
var ADVISOR_QUARANTINE_PREFIX = "Advisor response quarantined";
var AdvisorOutputQuarantinedError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "AdvisorOutputQuarantinedError";
  }
};
var ADVISOR_OUTPUT_ONLY_HAZARDS = [
  { label: "account-deletion claim", pattern: /\buser\b.{0,80}\b(?:deleted|erased)\b.{0,80}\baccount\b/i },
  {
    label: "instruction override",
    pattern: /\bignore\s+(?:all\s+)?(?:prior|previous|earlier)\s+(?:user\s+)?instructions\b/i
  },
  {
    label: "destructive shell command",
    pattern: /\brm\s+(?=(?:-[a-z]+\s*)*-[a-z]*r[a-z]*)(?=(?:-[a-z]+\s*)*-[a-z]*f[a-z]*)(?:-[a-z]+\s*)+/i
  },
  { label: "denial instruction", pattern: /\bdeny\s+(?:this|it|the\s+request)\s+if\s+(?:asked|questioned)\b/i }
];
function quarantineAdvisorUnsafeOutput(blocks, availableToolNames, sourceText = "") {
  const reasons = [];
  const unavailableToolNames = /* @__PURE__ */ new Set();
  const generatedParts = [];
  for (const block of blocks) {
    if (block.type === "tool-call" && !availableToolNames.has(block.name)) {
      unavailableToolNames.add(block.name);
    }
    if (block.type === "tool-call" && block.name === "advise") {
      try {
        const args = JSON.parse(block.arguments);
        if (typeof args.note === "string") generatedParts.push(args.note);
      } catch {
      }
    }
    if (block.type === "text") generatedParts.push(block.text);
  }
  if (unavailableToolNames.size > 0) {
    const names = [...unavailableToolNames].sort();
    const toolLabel = names.length === 1 ? "tool" : "tools";
    reasons.push(`requested unavailable ${toolLabel} ${names.join(", ")}`);
  }
  const generatedText = generatedParts.join("\n");
  if (generatedText) {
    const labels = [];
    const matchedLabels = [];
    for (const hazard of ADVISOR_OUTPUT_ONLY_HAZARDS) {
      if (!hazard.pattern.test(generatedText)) continue;
      matchedLabels.push(hazard.label);
      if (!hazard.pattern.test(sourceText)) labels.push(hazard.label);
    }
    if (matchedLabels.includes("destructive shell command") && labels.includes("instruction override") && !labels.includes("destructive shell command")) {
      labels.push("destructive shell command");
    }
    if (labels.includes("destructive shell command") || labels.length >= 3) {
      reasons.push(`generated output-only destructive directives: ${labels.join(", ")}`);
    }
  }
  if (reasons.length === 0) return void 0;
  return `${ADVISOR_QUARANTINE_PREFIX}: ${reasons.join("; ")}`;
}
function buildAdvisorQuarantineSourceText(currentInput, toolResultTexts) {
  const parts = [];
  if (currentInput) parts.push(currentInput);
  parts.push(...toolResultTexts);
  return parts.join("\n");
}

// src/tools.ts
import { readFile, readdir, stat } from "node:fs/promises";
import { resolve, relative, join } from "node:path";
var OUTPUT_LIMIT = 8e3;
var MAX_GREP_FILES = 200;
var MAX_GLOB_RESULTS = 100;
var SKIP_DIRS = /* @__PURE__ */ new Set(["node_modules", ".git", "dist", "build", ".next", ".cache", "__pycache__"]);
function confine(cwd, target) {
  const abs = resolve(cwd, target);
  const rel = relative(cwd, abs);
  if (rel.startsWith("..") || resolve(cwd, rel) !== abs) {
    throw new Error(`path escapes the session workspace: ${target}`);
  }
  return abs;
}
function clip(text) {
  if (text.length <= OUTPUT_LIMIT) return text;
  return `${text.slice(0, OUTPUT_LIMIT)}
\u2026[truncated ${text.length - OUTPUT_LIMIT} chars]`;
}
async function readTool(ctx, args) {
  const abs = confine(ctx.cwd, args.path);
  const raw = await readFile(abs, "utf8");
  const lines = raw.split("\n");
  const offset = Math.max(1, args.offset ?? 1);
  const limit = Math.min(Math.max(1, args.limit ?? 400), 2e3);
  const slice = lines.slice(offset - 1, offset - 1 + limit);
  const numbered = slice.map((line, i) => `${offset + i}: ${line}`).join("\n");
  return { text: clip(numbered) };
}
async function walk(dir, out, budget) {
  if (out.length >= budget) return;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (out.length >= budget) return;
    if (entry.isSymbolicLink()) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
      await walk(full, out, budget);
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
}
async function grepTool(ctx, args) {
  let regex;
  try {
    regex = new RegExp(args.pattern);
  } catch (err) {
    return { text: `invalid regex: ${String(err)}`, isError: true };
  }
  const root = confine(ctx.cwd, args.path ?? ".");
  const rootStat = await stat(root).catch(() => void 0);
  if (!rootStat) return { text: `no such path: ${args.path}`, isError: true };
  const files = [];
  if (rootStat.isFile()) files.push(root);
  else await walk(root, files, MAX_GREP_FILES);
  const matches = [];
  for (const file of files) {
    let raw;
    try {
      raw = await readFile(file, "utf8");
    } catch {
      continue;
    }
    if (raw.includes("\0")) continue;
    const lines = raw.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        matches.push(`${relative(ctx.cwd, file)}:${i + 1}: ${lines[i].slice(0, 300)}`);
        if (matches.length >= 100) return { text: clip(matches.join("\n") + "\n\u2026[more matches truncated]") };
      }
    }
  }
  return { text: matches.length > 0 ? clip(matches.join("\n")) : "no matches" };
}
function globMatch(name2, pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\0").replace(/\*/g, "[^/]*").replace(/\u0000/g, ".*").replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`).test(name2);
}
async function globTool(ctx, args) {
  const root = confine(ctx.cwd, args.path ?? ".");
  const files = [];
  await walk(root, files, 5e3);
  const matched = files.map((file) => relative(ctx.cwd, file)).filter((rel) => globMatch(rel, args.pattern) || globMatch(rel.split("/").pop() ?? "", args.pattern)).sort().slice(0, MAX_GLOB_RESULTS);
  return { text: matched.length > 0 ? matched.join("\n") : "no matches" };
}
var ADVISOR_TOOL_SCHEMAS = [
  {
    name: "read",
    description: "Read a UTF-8 text file from the watched workspace; returns line-numbered content.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["path"],
      properties: {
        path: { type: "string", description: "File path relative to the workspace root." },
        offset: { type: "number", description: "1-based first line to return. Defaults to 1." },
        limit: { type: "number", description: "Maximum lines to return. Defaults to 400." }
      }
    }
  },
  {
    name: "grep",
    description: "Search file contents in the watched workspace with a regular expression; returns matching lines with file:line locations.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["pattern"],
      properties: {
        pattern: { type: "string", description: "Regular expression to search for." },
        path: { type: "string", description: "File or directory to search. Defaults to the workspace root." }
      }
    }
  },
  {
    name: "glob",
    description: "Find files in the watched workspace whose paths match a glob pattern (supports *, **, ?).",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["pattern"],
      properties: {
        pattern: { type: "string", description: 'Glob pattern, e.g. "src/**/*.ts".' },
        path: { type: "string", description: "Directory to search in. Defaults to the workspace root." }
      }
    }
  }
];
var DEFAULT_ADVISOR_TOOL_NAMES = /* @__PURE__ */ new Set(["read", "grep", "glob", "advise"]);
async function executeAdvisorTool(ctx, name2, rawArguments) {
  let args = {};
  if (rawArguments.trim()) {
    try {
      args = JSON.parse(rawArguments);
    } catch {
      return { text: "arguments are not valid JSON", isError: true };
    }
  }
  try {
    switch (name2) {
      case "read":
        if (typeof args.path !== "string") return { text: "path is required", isError: true };
        return await readTool(ctx, args);
      case "grep":
        if (typeof args.pattern !== "string") return { text: "pattern is required", isError: true };
        return await grepTool(ctx, args);
      case "glob":
        if (typeof args.pattern !== "string") return { text: "pattern is required", isError: true };
        return await globTool(ctx, args);
      default:
        throw new Error(`unknown advisor tool: ${name2}`);
    }
  } catch (err) {
    return { text: String(err instanceof Error ? err.message : err), isError: true };
  }
}

// src/prompts/system.md
var system_default = '<system-conventions>\nRFC 2119: MUST, REQUIRED, SHOULD, RECOMMENDED, MAY, OPTIONAL. `NEVER`=`MUST NOT`; `AVOID`=`SHOULD NOT`.\n</system-conventions>\n\nUser, code-quality, robustness advocate; peer-shadow main agent.\n- Sharpen strategy, problem-solving, judgment; identify cleaner approach.\n- Challenge premature "done", thin verification, skipped reasoning.\n- Enforce user ask; flag drift immediately.\n- Prevent rabbit holes, overthinking, baked-in edge cases.\n\nCover skipped angles; NEVER re-run reasoning agent already has. Advise before wrong-direction work.\n\n<workflow>\nReceive incremental agent transcript, including thoughts.\nVerify suspicions with session-granted tools. Default read-only: `read`, `grep`, `glob`; operators MAY extend grant via `WATCHDOG.yml`. Advice primary; use granted mutating tools only when verification genuinely needs them.\nPer `advise`: 2\u20133 tool calls. Critical bugs MAY need deeper verification before a `blocker`.\n</workflow>\n\n<communication>\n- Surface commentary via `advise`: max 1/update.\n- Silence preferred when agent on track.\n- Address agent directly; offer alternatives, not lectures.\n- NEVER restate information agent has, including seen errors: type errors, LSP diagnostics, failed builds/tests, lint.\n- NEVER repeat prior advice or send identical advice twice; allow action before revisiting its theme.\n- `[in progress \u2014 more steps follow]` update heading: agent mid-turn. Withhold critique of partial work; only raise `blocker` for unrecoverable side effect actively executing now.\n- NEVER nitpick what user accepts. User-aligned: their word truth, frustration justified, requirements binding.\n</communication>\n\n<critical>\nAdvise only on concrete technical risk or transcript-evident execution failure; generic uncertainty, vague unease, user-intent ambiguity \u2192 SILENT.\n\nNEVER second-guess decisions the agent understands and commits to unless certain.\n\nNEVER advise on user intent or ceremony:\n- NEVER tell agent to seek clarification, confirm scope, summarize input, or narrate workflow.\n- NEVER question clarity of user ask.\n- Intent belongs to main agent; default informed action.\n- Your lane: correctness, edge cases, design, execution strategy, verification.\n\nNEVER police scope or ambition:\n- Large diff, wholesale rewrite, expanding plan alone NOT a problem; often user wants it.\n- Object ONLY when explicit instruction is breached, ambient user work is touched, or a bounded request gains unrequested features; cite evidence.\n\nNEVER raise backwards compatibility unless user or standing project rule explicitly requires it:\n- No unsolicited breaking-change, deprecation-shim, migration-path, legacy-fallback, or API-stability concerns/blockers.\n- Without requirement: clean cutover\u2014delete old path, migrate every caller, remove obsolete tests.\n- NEVER preserve removed behavior solely to satisfy its tests.\n\nCite only transcript evidence or personally inspected tool output.\nUnrendered arguments UNKNOWN:\n- NEVER assert concrete values, array indexes, serialization shapes, or caller mistakes for hidden arguments.\n- Hidden/omitted arguments + failure: state observable facts; suggest inspecting missing field.\n- Example: timed-out `grep` showing only `pattern` NEVER establishes `paths[0]`, array flattening, or malformed `paths`.\nCite exact instruction or risk.\n</critical>\n\n<completeness>\n**`nit`**\n- Non-urgent cleanup, refactor, style, missed opportunity.\n- Fold at next step boundary; agent continues.\n- Examples: non-breaking edge cases; simplifications; better approach to consider.\n\n**`concern`**\n- Agent may head wrong or miss material issue; offer view, agent decides.\n- Use for:\n  - Wrong code path, missing constraint, or soon-baked edge case.\n  - Serializing \u22652 independent, non-overlapping units; name concrete partitions.\n  - Resolved next action delayed by repeated planning or unchanged analysis.\n  - Subagent prompts omit goal/context/ownership or script safe local decisions.\n  - Implementation guesses accessible source, contracts, docs, or logs; name the authority.\n  - Explicit tool/workflow ignored, or a transcript-confirmed specialized tool bypassed.\n  - Runtime behavior, performance, or cause guessed despite an executable check.\n  - Speculative flags, wrappers, caches, dependencies, or files without demonstrated need.\n  - Local defensive workaround despite verified upstream or central cause.\n  - Prompt/docs double-narrate examples or expose irrelevant implementation internals.\n  - Evident context exhaustion or repeated root dumps needing a persistent shared brief.\n  - Churn/cycling without progress; repeated user correction ignored.\n\n**`blocker`**\n- Stop/reconsider.\n- ONLY when continued progress clearly:\n  - Contradicts explicit transcript instruction\u2014cite it; size, rewrite breadth, evolving plan alone NEVER trigger.\n  - Will require later user interruption because agent circles without solution.\n  - Fundamentally unsound.\n  - Claims completion after sampling or dropping explicit exhaustive/multi-target scope.\n  - Substitutes stubs, TODOs, toys, or mocks for required implementation/live verification without permission.\n  - Hands off as "done" work never exercised against user\'s actual ask.\n  - Yields before explicit convergence condition (green CI, passing tests, benchmark target) is met.\n  - Ships verification too thin for risk just taken.\n  - Is plainly stalling user\'s goal through overthinking/rabbit hole.\n- Verify thoroughly before raising.\n</completeness>\n\nMAY suggest approach/fix after enough exploration for confidence. Offer better designs, not only warning.\n';

// src/prompts/advise-tool.md
var advise_tool_default = "Watched agent: send 1 concrete, terse advice.\nUse sparingly; stay silent when nothing matters.\nCall to avert likely-wrong or materially wasteful work.\n";

// src/prompts/context-files.md
var context_files_default = `<project-context>
Context files: user's standing project instructions (AGENTS.md etc.); binding on driving agent. Enforce; flag drift immediately; NEVER advise against mandates.
{{#each contextFiles}}
<file path="{{path}}">
{{content}}
</file>
{{/each}}
</project-context>
`;

// src/advisor-loop.ts
var CONTEXT_CHAR_BUDGET = 4e5;
var CONTEXT_FILE_NAMES = ["AGENTS.md", "CLAUDE.md", ".cursorrules"];
function userMessage(text) {
  return {
    id: randomUUID(),
    role: "user",
    content: [{ type: "text", text }],
    source: { kind: "plugin", plugin: "dsh-omp-advisor" }
  };
}
function assistantMessage(blocks, provider, model) {
  return {
    id: randomUUID(),
    role: "assistant",
    content: blocks,
    source: { kind: "model", provider, model }
  };
}
function toolResultMessage(callId, text, isError) {
  return {
    id: randomUUID(),
    role: "user",
    content: [{ type: "tool-result", toolCallId: callId, content: [{ type: "text", text }], isError }],
    source: { kind: "tool", callId }
  };
}
async function loadContextFiles(cwd) {
  const found = [];
  for (const name2 of CONTEXT_FILE_NAMES) {
    try {
      const content = await readFile2(join2(cwd, name2), "utf8");
      if (content.trim()) found.push({ path: name2, content: content.slice(0, 2e4) });
    } catch {
    }
  }
  return found;
}
function renderContextFiles(files) {
  if (files.length === 0) return "";
  const body = files.map((file) => `<file path="${file.path}">
${file.content}
</file>`).join("\n");
  return context_files_default.replace("{{#each contextFiles}}", "").replace("{{/each}}", body);
}
async function collectStream(stream) {
  const blocks = [];
  let finishKind = "stop";
  let failure;
  for await (const chunk of stream) {
    if (chunk.type === "block-end") {
      blocks.push(chunk.block);
    } else if (chunk.type === "finish") {
      finishKind = chunk.reason.kind;
      if (chunk.reason.kind === "error" || chunk.reason.kind === "aborted") {
        failure = chunk.reason.failure;
      }
    }
  }
  return { blocks, finishKind, failure };
}
var AdvisorLoop = class {
  constructor(host, entry) {
    this.host = host;
    this.entry = entry;
    this.gate = new AdviseGate((note, severity) => host.onAdvice(note, severity, entry.name));
  }
  messages = [];
  contextFilesLoaded = false;
  contextFilesText = "";
  charSize = 0;
  gate;
  get advisorName() {
    return this.entry.name;
  }
  /** Replace the entry when settings change (model, maxTurns, instructions). */
  updateEntry(entry) {
    this.entry = entry;
  }
  /** Drop the advisor's conversation (context loss / settings rebuild). The session cursor is owned by the runtime and stays. */
  resetConversation() {
    this.messages = [];
    this.charSize = 0;
    this.contextFilesLoaded = false;
    this.gate.resetDeliveredNotes();
  }
  systemText() {
    const parts = [system_default.trim()];
    if (this.contextFilesText) parts.push(this.contextFilesText);
    parts.push(`Tool reference for \`advise\`:
${advise_tool_default.trim()}`);
    if (this.entry.instructions?.trim()) {
      parts.push(`<specialization>
${this.entry.instructions.trim()}
</specialization>`);
    }
    return parts.join("\n\n");
  }
  trackSize(text) {
    this.charSize += text.length;
  }
  maybeResetForContext() {
    if (this.charSize <= CONTEXT_CHAR_BUDGET) return;
    this.host.log?.("advisor context reset (budget)", { advisor: this.entry.name });
    this.resetConversation();
  }
  /**
   * Review one transcript delta. Runs the tool loop until the advisor calls
   * `advise`, stops calling tools, or exhausts `maxTurns`.
   *
   * @returns true when the turn completed (even silently); throws on model failure.
   */
  async review(deltaText, opts) {
    if (!this.contextFilesLoaded) {
      this.contextFilesLoaded = true;
      this.contextFilesText = renderContextFiles(await loadContextFiles(this.host.cwd));
    }
    this.maybeResetForContext();
    this.gate.beginUpdate(opts.inProgress);
    this.messages.push(userMessage(deltaText));
    this.trackSize(deltaText);
    const toolSchemas = [
      ...ADVISOR_TOOL_SCHEMAS,
      ADVISE_TOOL_SCHEMA
    ];
    const maxTurns = Math.max(1, this.entry.maxTurns || 4);
    let advised = false;
    for (let turn = 0; turn < maxTurns; turn++) {
      if (opts.signal.aborted) return false;
      const request = {
        provider: this.entry.provider,
        model: this.entry.model,
        ...this.entry.reasoningEffort ? { reasoningEffort: this.entry.reasoningEffort } : {},
        messages: this.messages,
        system: this.systemText(),
        tools: toolSchemas,
        signal: opts.signal
      };
      const { blocks, failure } = await collectStream(this.host.llm.stream(request));
      if (failure) {
        this.messages.pop();
        throw new Error(`advisor model failure (${failure.code}): ${failure.message}`);
      }
      if (blocks.length === 0) {
        this.messages.pop();
        throw new Error("advisor model returned no content");
      }
      const sourceText = buildAdvisorQuarantineSourceText(deltaText, []);
      const quarantine = quarantineAdvisorUnsafeOutput(blocks, DEFAULT_ADVISOR_TOOL_NAMES, sourceText);
      if (quarantine) {
        this.messages.push(assistantMessage([{ type: "text", text: quarantine }], this.entry.provider, this.entry.model));
        throw new Error(quarantine);
      }
      this.messages.push(assistantMessage(blocks, this.entry.provider, this.entry.model));
      this.trackSize(JSON.stringify(blocks));
      const toolCalls = blocks.filter((b) => b.type === "tool-call");
      if (toolCalls.length === 0) return true;
      let producedAdvice = false;
      for (const call of toolCalls) {
        if (call.name === "advise") {
          let args = {};
          try {
            args = JSON.parse(call.arguments);
          } catch {
          }
          if (typeof args.note !== "string" || !args.note.trim()) {
            this.messages.push(toolResultMessage(call.id, "advise requires a non-empty note string.", true));
            continue;
          }
          const severity = args.severity === "concern" || args.severity === "blocker" || args.severity === "nit" ? args.severity : void 0;
          const result2 = this.gate.advise(args.note, severity);
          if (result2.delivered || result2.deferred) producedAdvice = true;
          this.messages.push(toolResultMessage(call.id, result2.modelReply, false));
          continue;
        }
        if (!DEFAULT_ADVISOR_TOOL_NAMES.has(call.name)) {
          this.messages.push(toolResultMessage(call.id, `Tool not available: ${call.name}`, true));
          continue;
        }
        const result = await executeAdvisorTool({ cwd: this.host.cwd }, call.name, call.arguments);
        this.messages.push(toolResultMessage(call.id, result.text, result.isError === true));
        this.trackSize(result.text);
      }
      if (producedAdvice) advised = true;
      if (producedAdvice) return true;
    }
    return advised || true;
  }
};

// src/delivery.ts
var ADVISOR_GUIDANCE = "weigh, don't blindly obey";
function escapeXmlText(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeXmlAttribute(value) {
  return escapeXmlText(value).replace(/"/g, "&quot;");
}
function formatAdvisorBatchContent(notes) {
  return notes.map((note) => {
    const severity = note.severity ? ` severity="${note.severity}"` : "";
    const who = note.advisor ? ` advisor="${escapeXmlAttribute(note.advisor)}"` : "";
    return `<advisory${who}${severity} guidance="${ADVISOR_GUIDANCE}">
${escapeXmlText(note.note)}
</advisory>`;
  }).join("\n");
}
function isInterruptingSeverity(severity, interruptSeverities) {
  return interruptSeverities.includes(severity ?? "nit");
}
function resolveDeliveryChannel(opts) {
  const { severity, interruptSeverities, primaryRunning } = opts;
  if (!isInterruptingSeverity(severity, interruptSeverities)) return "inject";
  if (primaryRunning) return "steer";
  return severity === "blocker" ? "steer" : "inject";
}

// src/delta.ts
var PLUGIN_NAME = "dsh-omp-advisor";
var TEXT_PREVIEW_LIMIT = 2e3;
var ARGS_PREVIEW_LIMIT = 400;
function truncate(text, limit) {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}
\u2026[truncated ${text.length - limit} chars]`;
}
function blocksToText(content) {
  if (!Array.isArray(content)) return "";
  const parts = [];
  for (const block of content) {
    if (block && typeof block === "object") {
      const b = block;
      if (b.type === "text" && typeof b.text === "string") parts.push(b.text);
    }
  }
  return parts.join("\n");
}
function isOwnPluginMessage(data) {
  return data?.source?.kind === "plugin" && data?.source?.plugin === PLUGIN_NAME;
}
function renderDelta(events, cursor, updateIndex, inProgress) {
  const sections = [];
  const toolResultTexts = [];
  const toolNames = /* @__PURE__ */ new Map();
  let index = Math.max(0, cursor);
  for (; index < events.length; index++) {
    const event = events[index];
    if (!event || typeof event.type !== "string") continue;
    const data = event.data ?? event;
    switch (event.type) {
      case "user/message": {
        if (isOwnPluginMessage(data)) break;
        const text = blocksToText(data.content);
        if (text.trim()) sections.push(`### User
${truncate(text, TEXT_PREVIEW_LIMIT)}`);
        break;
      }
      case "assistant/message": {
        const message = data.message;
        const text = blocksToText(message?.content);
        const interrupted = data.interrupted === true ? " (interrupted)" : "";
        if (text.trim()) sections.push(`### Assistant${interrupted}
${truncate(text, TEXT_PREVIEW_LIMIT)}`);
        break;
      }
      case "tool/call": {
        const name2 = typeof data.name === "string" ? data.name : "tool";
        if (typeof data.callId === "string") toolNames.set(data.callId, name2);
        let argsPreview = "";
        if (typeof data.arguments === "string" && data.arguments.trim() && data.arguments.trim() !== "{}") {
          argsPreview = `
\`\`\`json
${truncate(data.arguments, ARGS_PREVIEW_LIMIT)}
\`\`\``;
        }
        sections.push(`### Tool call: ${name2}${argsPreview}`);
        break;
      }
      case "tool/result": {
        const message = data.message;
        const callId = typeof message?.content?.[0]?.toolCallId === "string" ? message.content[0].toolCallId : void 0;
        const name2 = callId && toolNames.get(callId) || "tool";
        const text = blocksToText(message?.content?.[0]?.content ?? message?.content);
        const isError = data.error !== void 0 || message?.content?.[0]?.isError === true;
        const status = isError ? " (error)" : "";
        const body = text.trim() ? truncate(text, TEXT_PREVIEW_LIMIT) : "(no output)";
        toolResultTexts.push(body);
        sections.push(`### Tool result: ${name2}${status}
${body}`);
        break;
      }
      default:
        break;
    }
  }
  if (sections.length === 0) {
    return { text: "", nextCursor: index, toolResultTexts };
  }
  const heading = inProgress ? `## Update ${updateIndex} [in progress \u2014 more steps follow]` : `## Update ${updateIndex}`;
  return {
    text: `${heading}

${sections.join("\n\n")}`,
    nextCursor: index,
    toolResultTexts
  };
}

// src/runtime.ts
var MAX_CONSECUTIVE_FAILURES = 3;
var QUOTA_COOLDOWN_MS = 5 * 6e4;
var RECENT_NOTES_LIMIT = 20;
var QUOTA_CODES = /* @__PURE__ */ new Set(["RATE_LIMIT", "QUOTA", "QUOTA_EXHAUSTED", "RATE_LIMITED", "TOO_MANY_REQUESTS"]);
function isQuotaFailure(error) {
  const message = String(error instanceof Error ? error.message : error);
  if (/rate.?limit|quota|429|too many requests/i.test(message)) return true;
  const code = error?.code;
  return typeof code === "string" && QUOTA_CODES.has(code.toUpperCase());
}
function isPermanentFailure(error) {
  return /model not (found|supported)|no adapter|unknown provider|invalid (provider|model)|does not exist/i.test(
    String(error instanceof Error ? error.message : error)
  );
}
var SessionAdvisorRuntime = class {
  constructor(host, settings, createUserMessage2) {
    this.host = host;
    this.createUserMessage = createUserMessage2;
    this.interruptSeverities = [...settings.interruptSeverities];
    this.rebuild(settings);
  }
  slots = /* @__PURE__ */ new Map();
  disposed = false;
  recentNotes = [];
  interruptSeverities;
  /** Rebuild advisor slots from settings, preserving cursors where the advisor survives. */
  rebuild(settings) {
    if (this.disposed) return;
    this.interruptSeverities = [...settings.interruptSeverities];
    const next = /* @__PURE__ */ new Map();
    for (const entry of settings.advisors) {
      const key = entry.name;
      const existing = this.slots.get(key);
      if (existing) {
        existing.entry = entry;
        existing.loop.updateEntry(entry);
        if (existing.status === "halted" || existing.status === "error") {
          existing.status = entry.enabled === false ? "paused" : "running";
          existing.consecutiveFailures = 0;
          existing.lastError = void 0;
          existing.loop.resetConversation();
        } else if (entry.enabled === false) {
          existing.status = "paused";
        } else if (existing.status === "paused") {
          existing.status = "running";
        }
        next.set(key, existing);
        continue;
      }
      next.set(key, {
        entry,
        loop: new AdvisorLoop(
          {
            llm: this.host.llm,
            cwd: this.host.cwd,
            onAdvice: (note, severity, advisorName) => this.deliver(note, severity, advisorName),
            log: this.host.log
          },
          entry
        ),
        cursor: 0,
        updateIndex: 1,
        status: entry.enabled === false ? "paused" : "running",
        backlog: 0,
        reviewsCompleted: 0,
        adviceDelivered: 0,
        consecutiveFailures: 0,
        draining: false,
        queued: []
      });
    }
    this.slots = next;
  }
  /** Queue one review pass for every enabled advisor (called on step/turn end). */
  enqueueReview(inProgress) {
    if (this.disposed) return;
    for (const slot of this.slots.values()) {
      if (slot.status !== "running") continue;
      if (slot.queued.length > 0 && slot.queued[slot.queued.length - 1].inProgress === inProgress) continue;
      slot.queued.push({ inProgress });
      slot.backlog = slot.queued.length;
      void this.drain(slot);
    }
  }
  async drain(slot) {
    if (slot.draining || this.disposed) return;
    slot.draining = true;
    try {
      while (!this.disposed && slot.queued.length > 0) {
        if (slot.status !== "running") {
          slot.queued = [];
          slot.backlog = 0;
          return;
        }
        if (slot.quotaUntil && Date.now() < slot.quotaUntil) return;
        if (slot.quotaUntil && Date.now() >= slot.quotaUntil) {
          slot.quotaUntil = void 0;
          slot.status = "running";
        }
        const item = slot.queued.shift();
        slot.backlog = slot.queued.length;
        const events = this.host.getEvents();
        const delta = renderDelta(events, slot.cursor, slot.updateIndex, item.inProgress);
        slot.cursor = delta.nextCursor;
        if (!delta.text.trim()) {
          continue;
        }
        const controller = new AbortController();
        const abort = () => controller.abort();
        const agent = this.host.getAgent();
        const disposeWatch = agent ? void 0 : void 0;
        void disposeWatch;
        try {
          await slot.loop.review(delta.text, { inProgress: item.inProgress, signal: controller.signal });
          slot.updateIndex++;
          slot.reviewsCompleted++;
          slot.consecutiveFailures = 0;
          slot.lastError = void 0;
        } catch (error) {
          if (this.disposed) return;
          slot.consecutiveFailures++;
          slot.lastError = String(error instanceof Error ? error.message : error);
          this.host.log?.("advisor review failed", {
            session: this.host.sessionId,
            advisor: slot.entry.name,
            failures: slot.consecutiveFailures,
            error: slot.lastError
          });
          if (isPermanentFailure(error)) {
            slot.status = "halted";
            slot.queued = [];
            slot.backlog = 0;
            return;
          }
          if (isQuotaFailure(error)) {
            slot.status = "quota_exhausted";
            slot.quotaUntil = Date.now() + QUOTA_COOLDOWN_MS;
            return;
          }
          if (slot.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            slot.queued = [];
            slot.backlog = 0;
            slot.consecutiveFailures = 0;
            slot.loop.resetConversation();
            return;
          }
          await new Promise((resolve2) => setTimeout(resolve2, 1500));
        }
      }
    } finally {
      slot.draining = false;
    }
  }
  /** Route one accepted advice note into the primary agent. */
  deliver(note, severity, advisorName) {
    const agent = this.host.getAgent();
    const advisorNote = { note, severity, advisor: advisorName };
    this.recentNotes.push(advisorNote);
    if (this.recentNotes.length > RECENT_NOTES_LIMIT) this.recentNotes.shift();
    const slot = this.slots.get(advisorName);
    if (slot) slot.adviceDelivered++;
    if (!agent) {
      this.host.log?.("advisor note dropped (no live agent)", { session: this.host.sessionId, advisorName });
      return;
    }
    const primaryRunning = agent.status === "running";
    const channel = resolveDeliveryChannel({
      severity,
      interruptSeverities: this.interruptSeverities,
      primaryRunning
    });
    const message = this.createUserMessage(formatAdvisorBatchContent([advisorNote]));
    if (channel === "steer") agent.steer(message);
    else agent.inject(message);
    this.host.log?.("advisor note delivered", {
      session: this.host.sessionId,
      advisor: advisorName,
      severity: severity ?? "nit",
      channel
    });
  }
  /** Snapshot for the RPC surface. */
  snapshot() {
    return {
      active: this.slots.size > 0,
      advisors: [...this.slots.values()].map((slot) => ({
        name: slot.entry.name,
        status: slot.status,
        backlog: slot.backlog,
        reviewsCompleted: slot.reviewsCompleted,
        adviceDelivered: slot.adviceDelivered,
        ...slot.lastError ? { lastError: slot.lastError } : {}
      })),
      recentNotes: [...this.recentNotes]
    };
  }
  /** Pause or resume one advisor by name. */
  setPaused(name2, paused) {
    const slot = this.slots.get(name2);
    if (!slot) return false;
    if (paused) {
      slot.status = "paused";
      slot.queued = [];
      slot.backlog = 0;
    } else if (slot.status === "paused") {
      slot.status = "running";
    }
    return true;
  }
  dispose() {
    this.disposed = true;
    for (const slot of this.slots.values()) {
      slot.queued = [];
      slot.backlog = 0;
    }
    this.slots.clear();
  }
};

// src/settings.ts
import z from "@deepseek-ai/schemastery";
var SETTINGS_NAMESPACE = "dsh-omp-advisor";
var advisorEntrySchema = z.object({
  name: z.string().required().description("Advisor display name (unique within the roster)."),
  provider: z.string().required().description("DSH provider route id, from the model list."),
  model: z.string().required().description("Model id served by that provider route."),
  reasoningEffort: z.string().description("Optional adapter-owned reasoning effort for this model."),
  maxTurns: z.number().min(1).max(10).default(4).description("Max advisor tool-loop turns per review (investigation budget)."),
  instructions: z.string().description("Optional specialization appended to the shared advisor baseline."),
  enabled: z.boolean().default(true).description("Per-advisor on/off toggle.")
});
var advisorSettingsSchema = z.object({
  enabled: z.boolean().default(false).description("Master switch: attach advisors to sessions."),
  reviewTrigger: z.union(["step", "turn"]).default("turn").description("Feed transcript deltas to advisors at step boundaries or turn boundaries."),
  interruptSeverities: z.array(z.union(["nit", "concern", "blocker"])).default(["concern", "blocker"]).description("Severities delivered as steering (nearest step boundary); others ride non-interrupting context."),
  advisors: z.array(advisorEntrySchema).default([]).description("Advisor roster.")
});
function normalizeSettings(raw) {
  const value = raw ?? {};
  const advisors = Array.isArray(value.advisors) ? value.advisors : [];
  const seen = /* @__PURE__ */ new Set();
  const deduped = [];
  for (const entry of advisors) {
    if (!entry || typeof entry.name !== "string" || !entry.name.trim()) continue;
    if (typeof entry.provider !== "string" || !entry.provider.trim()) continue;
    if (typeof entry.model !== "string" || !entry.model.trim()) continue;
    const name2 = entry.name.trim();
    if (seen.has(name2)) continue;
    seen.add(name2);
    deduped.push({
      name: name2,
      provider: entry.provider,
      model: entry.model,
      ...typeof entry.reasoningEffort === "string" && entry.reasoningEffort ? { reasoningEffort: entry.reasoningEffort } : {},
      maxTurns: Math.min(10, Math.max(1, Math.round(entry.maxTurns || 4))),
      ...typeof entry.instructions === "string" && entry.instructions.trim() ? { instructions: entry.instructions.trim() } : {},
      enabled: entry.enabled !== false
    });
  }
  const severities = Array.isArray(value.interruptSeverities) ? value.interruptSeverities.filter(
    (s) => s === "nit" || s === "concern" || s === "blocker"
  ) : ["concern", "blocker"];
  return {
    enabled: value.enabled === true,
    reviewTrigger: value.reviewTrigger === "step" ? "step" : "turn",
    interruptSeverities: severities,
    advisors: deduped
  };
}

// src/service.ts
var SERVICE_NAME = "dsh-omp-advisor";
function sessionIdOf(session) {
  return String(session.id);
}
function sessionCwd(session) {
  const headerCwd = session.header?.cwd;
  if (typeof headerCwd === "string" && headerCwd) return headerCwd;
  const metaCwd = session.meta?.cwd;
  if (typeof metaCwd === "string" && metaCwd) return metaCwd;
  return process.cwd();
}
var AdvisorService = class extends Service {
  constructor(hostCtx, _config) {
    super(hostCtx, SERVICE_NAME);
    this.hostCtx = hostCtx;
    this.settingsScope = hostCtx.settings.register(SETTINGS_NAMESPACE, advisorSettingsSchema, {
      applies: "live",
      validate: (raw) => {
        const value = normalizeSettings(raw);
        for (const entry of value.advisors) {
          if (!entry.provider || !entry.model) {
            throw new Error(`advisor "${entry.name}" needs both provider and model from the model list`);
          }
        }
      }
    });
    this.settingsValue = normalizeSettings(this.settingsScope.get());
    hostCtx.on("session/created", (session) => {
      this.attach(session);
    });
    hostCtx.on("session/event", (session, event) => {
      this.onSessionEvent(session, event);
    });
    hostCtx.on("session/disposed", (session) => {
      this.detach(sessionIdOf(session));
    });
    this.settingsScope.watch((next) => {
      const value = normalizeSettings(next);
      this.settingsValue = value;
      if (!value.enabled) {
        for (const [id, runtime] of this.runtimes) {
          runtime.dispose();
          this.runtimes.delete(id);
        }
        return;
      }
      for (const runtime of this.runtimes.values()) runtime.rebuild(value);
    });
    if (hostCtx.connection) {
      registerAdvisorRpc(hostCtx, this);
    }
  }
  static inject = ["agents", "llm", "settings"];
  runtimes = /* @__PURE__ */ new Map();
  settingsValue;
  settingsScope;
  get settings() {
    return this.settingsValue;
  }
  attach(session) {
    if (!this.settingsValue.enabled) return;
    const id = sessionIdOf(session);
    if (this.runtimes.has(id)) return;
    const ctx = this.hostCtx;
    const runtime = new SessionAdvisorRuntime(
      {
        sessionId: id,
        getAgent: () => ctx.agents.get(id),
        getEvents: () => {
          const agent = ctx.agents.get(id);
          const events = agent?.session?.events ?? session.events;
          return events ?? [];
        },
        cwd: sessionCwd(session),
        llm: ctx.llm,
        makeUserMessage: (text) => createUserMessage({
          content: [{ type: "text", text }],
          source: { kind: "plugin", plugin: SERVICE_NAME }
        }),
        log: (message, meta) => ctx.logger?.debug?.(`${SERVICE_NAME}: ${message}`, meta ?? {})
      },
      this.settingsValue,
      (text) => createUserMessage({
        content: [{ type: "text", text }],
        source: { kind: "plugin", plugin: SERVICE_NAME }
      })
    );
    this.runtimes.set(id, runtime);
  }
  onSessionEvent(session, event) {
    if (!this.settingsValue.enabled) return;
    const runtime = this.runtimes.get(sessionIdOf(session));
    if (!runtime) {
      this.attach(session);
      const fresh = this.runtimes.get(sessionIdOf(session));
      if (!fresh) return;
      return;
    }
    const trigger = this.settingsValue.reviewTrigger;
    if (trigger === "step" && event.type === "step/end") {
      runtime.enqueueReview(true);
    } else if (event.type === "turn/end") {
      runtime.enqueueReview(false);
    }
  }
  detach(sessionId) {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) return;
    runtime.dispose();
    this.runtimes.delete(sessionId);
  }
  /** Snapshot one session's advisor state for the RPC surface. */
  snapshot(sessionId) {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) {
      return { sessionId, active: false, advisors: [], recentNotes: [] };
    }
    return { sessionId, ...runtime.snapshot() };
  }
  /** List sessions with attached advisor runtimes. */
  activeSessions() {
    return [...this.runtimes.keys()];
  }
  /** Pause or resume one advisor in one session. */
  setPaused(sessionId, advisorName, paused) {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) return false;
    return runtime.setPaused(advisorName, paused);
  }
  /** Trigger an immediate review pass for one session. */
  reviewNow(sessionId) {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) return false;
    runtime.enqueueReview(false);
    return true;
  }
};

// src/index.ts
var name = "dsh-omp-advisor";
var inject = ["settings", "agents", "llm"];
var Config = advisorSettingsSchema;
function apply(ctx, config) {
  new AdvisorService(ctx, config);
}
export {
  ADVISE_TOOL_SCHEMA,
  AdviseGate,
  AdvisorOutputQuarantinedError,
  AdvisorService,
  Config,
  SETTINGS_NAMESPACE,
  SessionAdvisorRuntime,
  advisorSettingsSchema,
  apply,
  formatAdvisorBatchContent,
  inject,
  name,
  normalizeSettings,
  quarantineAdvisorUnsafeOutput,
  renderDelta,
  resolveDeliveryChannel
};
//# sourceMappingURL=index.js.map
