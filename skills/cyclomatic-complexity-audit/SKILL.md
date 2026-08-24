---
name: cyclomatic-complexity-audit
description: Equips the advisor to detect over-complex functions — high branch counts, deep nesting, and logic that should be extracted into named helpers.
---

# Cyclomatic Complexity Audit

Cyclomatic complexity counts the independent paths through a function; each branch, loop, and condition adds one. High-complexity functions are hard to test, hard to review, and where bugs hide. Reviewers use complexity as an extraction trigger, not a vanity metric.

## Watch for
- Functions whose branch count far exceeds the project's agreed budget with no justification.
- Nesting deeper than three or four levels of if/loop/try.
- Long functions mixing several responsibilities that each deserve a name.
- Repeated near-identical branch blocks that differ only in a value (missing table/lookup).
- Boolean parameters that switch a function between two unrelated behaviors.
- Deeply nested callbacks or promise chains instead of flattened async/await.
- Giant switch statements where each case carries multi-line logic.
- Complexity pushed into a helper that is just as tangled, relocating rather than reducing it.

## Best practices
- Agree a per-function complexity budget and treat consistent overruns as a refactor trigger.
- Extract each coherent responsibility into a well-named helper; the name is the documentation.
- Replace repeated branch blocks with a lookup table or config-driven dispatch.
- Split boolean-flag functions into two functions or pass an explicit strategy.
- Flatten async nesting with async/await and early returns.
- Move deep switch logic into per-case handlers keyed by the discriminant.
- Reduce nesting by inverting conditions and returning early.
- After extraction, confirm each new helper is genuinely simpler, not just shorter.

## Quick checklist
- [ ] Functions stay within the agreed complexity budget or are justified.
- [ ] Nesting depth is bounded (no unbounded arrow code).
- [ ] Each function has one clear responsibility.
- [ ] Repeated branch blocks are collapsed into lookups.
- [ ] No boolean parameter toggles unrelated behaviors.
- [ ] Async logic is flattened, not callback-nested.
- [ ] Large switches dispatch to per-case handlers.
- [ ] Extracted helpers are measurably simpler.
