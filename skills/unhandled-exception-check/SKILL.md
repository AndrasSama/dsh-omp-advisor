---
name: unhandled-exception-check
description: Equips the advisor to find exception paths that escape their handlers — uncaught throws, missing try/catch boundaries, and crashes waiting on edge inputs.
---

# Unhandled Exception Check

An exception that escapes its intended boundary takes down more than the failing operation: in servers it can kill the process, in UIs it can blank the screen. Reviewers trace throw sites to their nearest legitimate catcher and verify every execution boundary (process, thread, request, render) has one.

## Watch for
- `throw` inside callbacks/timers/promises with no enclosing catcher.
- try/catch wrapping only part of the risky section, leaving adjacent calls exposed.
- Catch blocks that log but leave the system in a half-updated state.
- JSON.parse / regex / array access on external input without guards.
- Async boundaries (event emitters, message handlers) lacking error routing.
- Framework error boundaries missing or mounted too low in the tree.
- Destructuring or property access on possibly-null values from APIs.
- Startup code where one throw prevents the whole process from booting.

## Best practices
- Map every execution boundary to its handler: process hooks, request middleware, render boundaries.
- Guard at trust boundaries: validate/parse external input before use, not inside deep logic.
- Keep catch scope tight around the exact call that can fail; handle or rethrow with context.
- Fail fast on impossible states, but never on bad user input.
- Add a last-resort handler per boundary that logs enough to reproduce, then recovers or exits deliberately.
- Test with hostile inputs: malformed JSON, nulls, oversize payloads, wrong types.
- After any production crash, add the missing catcher and a regression test together.
- Prefer typed results (or explicit validation) over exception-driven control flow.

## Quick checklist
- [ ] Every throw site traced to a legitimate catcher.
- [ ] Each execution boundary has a last-resort error handler.
- [ ] External input validated before parsing/access.
- [ ] Catch blocks leave system state consistent.
- [ ] Async/callback boundaries route errors explicitly.
- [ ] Framework error boundaries cover the render/request tree.
- [ ] Hostile-input tests exist for parse/access paths.
- [ ] Crash fixes ship with catcher + regression test.
