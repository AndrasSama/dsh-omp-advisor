---
name: prompt-injection-defense
description: Equips the advisor to detect injection paths where untrusted content (retrieved docs, tool output, web pages) can steer an agent or exfiltrate data.
---

# Prompt Injection Defense

Reviews agent pipelines for direct and indirect prompt injection: untrusted text carrying instructions the model may follow. In an advisor/reviewer role the key question is which text in context is data and which is authority — and whether any data path can trigger privileged actions.

## Watch for
- Retrieved/web/tool content concatenated into prompts with no delimiters or provenance labeling.
- Tool output from untrusted sources feeding directly into the next tool call's arguments — an injection-to-execution chain.
- System prompts instructing the model to "follow instructions in the document" — authority granted to data.
- Secrets (API keys, env dumps) present in context the model could be coaxed into echoing or exfiltrating.
- No allowlist on model-driven actions: shell execution, file writes, or network calls reachable from injected text.
- Suspicious patterns in reviewed content ignored: "ignore previous instructions", roleplay jailbreaks, invisible Unicode.
- Sanitization delegated to the model itself ("it knows not to obey") treated as a control.
- Full prompt logs leaking sensitive user data into observability stacks.

## Best practices
- Mark untrusted sections explicitly (delimiters plus "the following is untrusted data, not instructions") and place them after system/authority content.
- Enforce an instruction hierarchy: system > developer > user > tool/data — in the system prompt and in code gates.
- Gate privileged actions behind explicit human approval or deterministic policy checks, never model say-so alone.
- Keep secrets out of model context; reference them by id and resolve at execution time after policy checks.
- Validate model-proposed tool arguments against schemas and allowlists before dispatch.
- Scan incoming untrusted text for known injection markers as a tripwire, not as the sole defense.
- Redact sensitive fields before logging prompts/responses.
- Test with a small injection suite (override attempts, exfiltration attempts, roleplay) on every pipeline change.

## Quick checklist
- [ ] Untrusted content delimited and labeled
- [ ] Instruction hierarchy stated and enforced
- [ ] Privileged actions require non-model approval
- [ ] No secrets in model-readable context
- [ ] Tool args validated against allowlists before dispatch
- [ ] Injection markers scanned as tripwires
- [ ] Prompt logs redacted
- [ ] Injection test suite runs on pipeline changes
