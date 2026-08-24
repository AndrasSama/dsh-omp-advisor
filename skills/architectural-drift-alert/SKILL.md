---
name: architectural-drift-alert
description: Equips the advisor to detect changes that quietly violate the project's intended architecture — layer bypasses, new coupling, and patterns the design explicitly forbade.
---

# Architectural Drift Alert

Drift is rarely one big violation; it is a hundred small shortcuts that each looked reasonable in isolation. Reviewers hold each diff against the documented architecture: layer boundaries, dependency direction, ownership of cross-cutting concerns, and the patterns earlier decisions retired or forbade.

## Watch for
- A layer calling past its neighbor (UI → database, handler → infra internals).
- New imports that invert the intended dependency direction.
- Business logic migrating into controllers, routes, or UI components.
- A second implementation of a concern that already has an owner (two caches, two auth paths).
- Revival of a pattern an ADR or refactor explicitly retired.
- Cross-module coupling through globals, shared mutable state, or event spaghetti.
- New framework idioms inconsistent with the stack the project standardized on.
- Circular dependencies appearing between packages/modules.

## Best practices
- Keep a short, living architecture doc (or ADR set) that names the boundaries — drift needs a definition before it can be flagged.
- Review each diff against boundary rules, not just local correctness.
- Enforce dependency direction with tooling where possible (import linters, module boundaries).
- When a shortcut seems necessary, require an ADR instead of a silent exception.
- One owner per cross-cutting concern; new implementations must replace, not join.
- Flag drift at introduction — retrofitting boundaries costs orders of magnitude more.
- Cite the specific rule or decision being bent, so the discussion is about the exception, not taste.
- Periodically audit hot spots (new modules, rushed features) where drift concentrates.

## Quick checklist
- [ ] Diff respects documented layer boundaries.
- [ ] Dependency direction unchanged or explicitly approved.
- [ ] Business logic stays in its designated layer.
- [ ] No duplicate owner introduced for an existing concern.
- [ ] Retired/forbidden patterns not revived without an ADR.
- [ ] No new circular or global-state coupling.
- [ ] Framework idioms consistent with the standardized stack.
- [ ] Any exception recorded as a decision, not left implicit.
