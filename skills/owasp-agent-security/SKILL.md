---
name: owasp-agent-security
description: Equips the advisor to audit agentic systems against the OWASP Top 10 for LLM Applications, from prompt injection to excessive agency.
---

# OWASP Agent Security

Agentic systems extend the OWASP LLM Top 10 with tool access, memory, and multi-step autonomy — which turns classic issues like prompt injection into full compromise paths.
Reviewing agent code means hunting for places where untrusted text reaches decisions, tools, or outputs without a trust boundary in between; assume every fetched document, tool result, and user message is adversarial.

## Watch for
- Prompt injection surfaces: web pages, emails, files, or tool results fed into the model context alongside instructions (LLM01)
- Excessive agency: tools with broad scopes, agents that can delete/pay/send without human confirmation, auto-execution of model-suggested commands (LLM06)
- Improper output handling: model output passed to eval, SQL, shell, or rendered as HTML without validation (LLM05)
- Sensitive data (API keys, PII, prior conversations) leaking into prompts, logs, or model responses (LLM02)
- System prompt leakage via "repeat your instructions" style probes (LLM07)
- Unbounded consumption: no caps on tool calls, tokens, loop iterations, or subagent spawning (LLM10)
- Indirect injection chains: agent A's output becomes agent B's instruction source with no sanitization

## Best practices
- Enforce least-privilege tool grants: per-task scopes, read-only by default, explicit allowlists for write/exec tools
- Require human-in-the-loop confirmation for irreversible or high-value actions (payments, deletes, external sends)
- Treat all retrieved content as data, never instructions: mark provenance and strip instruction-like patterns from untrusted inputs
- Validate and sanitize model output at every trust boundary before it reaches shells, queries, or the DOM
- Cap loops, token budgets, tool-call counts, and recursion depth; alert when a ceiling is hit
- Log full tool-call traces with inputs and outputs for audit, redacting secrets
- Red-team each new tool integration with injection payloads embedded in the content it processes

## Quick checklist
- [ ] No untrusted content reaches the context without data/instruction separation
- [ ] Write/exec tools are allowlisted and scoped, not open-ended
- [ ] Irreversible actions require explicit human confirmation
- [ ] Model output is validated before shell/SQL/DOM use
- [ ] Loops, tokens, and tool calls have hard caps
- [ ] Secrets and PII are redacted from prompts and logs
- [ ] New tool integrations ship with an injection test case
