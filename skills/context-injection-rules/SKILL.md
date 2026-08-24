---
name: context-injection-rules
description: Equips the advisor to detect context-budget abuse — stale injected data, system-prompt bloat, per-turn duplication, and unbounded context growth.
---

# Context Injection Rules Review

DSH plugins can inject text into the model's system prompt or into per-turn context, and both compete for a finite token budget. Good injection discipline decides what is stable enough for the system prompt versus what must be recomputed per turn, and caps everything. Reviewers should treat every injected byte as a cost with a benefit.

## Watch for
- Volatile data (timestamps, live status, per-request values) baked into the system prompt where it goes stale.
- The same block injected into both the system prompt and every turn, doubling the cost.
- Unbounded injection that grows with history or file count and has no cap or truncation policy.
- Full file contents or whole documents injected when a summary or path would suffice.
- Injection that ignores the stated token budget and silently overflows it.
- Stale context that contradicts newer information and is never invalidated.
- Secrets, tokens, or user-private data injected into prompts that reach the model or logs.
- Injection triggered on every turn when only specific turns actually need it.

## Best practices
- Put stable, session-wide instructions in the system prompt; put changing facts in per-turn context.
- Attach a freshness policy to every injected block: when it is recomputed and when it expires.
- Enforce an explicit token budget per injection source and truncate with a clear marker, never silently.
- Prefer references (paths, ids, summaries) over raw payloads; let the model request detail on demand.
- Gate per-turn injection on relevance so it only fires for turns that need it.
- Deduplicate across sources; a fact should have exactly one injection owner.
- Never inject secrets or personally sensitive data into prompts or logs.
- Log the size of each injection during development so budget regressions are visible.

## Quick checklist
- [ ] System prompt contains only stable, session-wide content.
- [ ] Volatile data is injected per turn with a freshness policy.
- [ ] No block is injected by more than one source.
- [ ] Every injection source has an enforced token budget.
- [ ] Large payloads are referenced, not inlined.
- [ ] Per-turn injection is gated on relevance.
- [ ] No secrets or private data reach prompts or logs.
- [ ] Injection sizes are measured and logged in development.
