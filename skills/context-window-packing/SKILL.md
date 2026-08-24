---
name: context-window-packing
description: Equips the advisor to evaluate how prompts are assembled against model context limits — truncation order, token accounting, output reservation, and cache-prefix stability.
---

# Context Window Packing

Reviews prompt assembly from system instructions, retrieved chunks, history, and user input under a hard token budget. Bad packing silently drops the most important content, truncates mid-token or mid-code, or breaks prompt-cache prefixes — each with measurable quality and cost impact.

## Watch for
- No output-token reservation: packing to 100% of context leaves no room for the completion (model errors or truncates).
- Truncation from the wrong end: dropping the system prompt or the latest user turn before old history.
- Token counts estimated as chars/4 without the model's actual tokenizer — systematically wrong, especially for code and non-English text.
- Retrieved chunks stuffed in raw similarity order with no dedup — near-duplicate passages waste budget.
- Truncation at arbitrary byte offsets, splitting multibyte characters or code blocks mid-token.
- Volatile content (timestamps, random ids) placed before stable content, invalidating prompt-cache prefixes every call.
- No priority policy: all sections treated as equal when budget pressure hits.
- Packing logic untested at the boundary (exactly-at-limit and one-over-limit cases).

## Best practices
- Budget formula: context_limit − max_output_tokens − safety margin (256–512) = packable budget; enforce it in code.
- Priority under pressure: system → latest user turn → recent history → retrieved context → old history (summarize, don't keep).
- Count tokens with the deployed model's tokenizer (tiktoken/sentencepiece); recount after templating, not before.
- Dedup retrieved chunks (hash or similarity > 0.95) and cap any single source's share of the budget.
- Truncate on semantic boundaries — message, paragraph, or chunk — never mid-token.
- Keep prompt prefixes byte-stable for caching: static system prompt first, volatile data last.
- Summarize old turns into a rolling digest instead of raw retention.
- Log per-section token counts each request; alert when truncation actually fires.

## Quick checklist
- [ ] Output tokens reserved before packing
- [ ] Truncation priority order defined and coded
- [ ] Token counts use the real tokenizer
- [ ] Retrieved chunks deduplicated
- [ ] Truncation respects message/chunk boundaries
- [ ] Prompt prefix stable for caching
- [ ] Boundary cases (at/over limit) tested
- [ ] Truncation events logged and metriced
