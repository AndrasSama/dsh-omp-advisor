---
name: plugin-lifecycle-hooks
description: Equips the advisor to detect lifecycle defects — non-idempotent activation, missing dispose cleanup, wrong hook ordering, and resource leaks across reloads.
---

# Plugin Lifecycle Hooks Review

A DSH plugin's correctness lives in its lifecycle: `activate()` must be safe to run on a cold start and after a reload, and `deactivate()` must return the host to a clean state. Most production plugin bugs are not logic errors but lifecycle errors — resources registered twice, timers never cleared, or teardown that runs in the wrong order.

## Watch for
- `activate()` that assumes a fresh process and breaks when called a second time after reload.
- Event listeners, intervals, or subscriptions added in activate with no matching removal in deactivate.
- Teardown order that disposes a dependency before its consumers (e.g. closing an RPC channel while handlers still reference it).
- Async work started in activate that can resolve after deactivate and touch disposed resources.
- Deactivate that throws on the first failure and skips the remaining cleanup steps.
- File handles, child processes, or server sockets opened at activation and never tracked for closure.
- Hooks that mutate shared host state without restoring it on deactivation.
- Missing guards against double-registration when the host re-activates after a settings change.

## Best practices
- Make activation idempotent: check-before-register, or unregister-then-register, for every named contribution.
- Keep a single registry (array/map) of disposers collected during activate; iterate it in reverse order during deactivate.
- Dispose in reverse of creation order so consumers shut down before their dependencies.
- Wrap each disposer in try/catch so one failing cleanup cannot block the rest.
- Track in-flight async work with a cancellation token or generation counter checked after each await.
- Treat deactivate as best-effort-but-complete: log failures, but always attempt every cleanup step.
- Register nothing at import time; everything belongs inside the activate hook.
- Add a reload test (activate → deactivate → activate) to the plugin's test suite as a first-class case.

## Quick checklist
- [ ] activate() succeeds when run twice in a row.
- [ ] Every listener/timer/subscription has a recorded disposer.
- [ ] Deactivation runs disposers in reverse creation order.
- [ ] Each disposer is individually try/caught.
- [ ] No async callback can fire against a disposed resource.
- [ ] No file/socket/process handle outlives deactivate().
- [ ] Shared host state mutated at activate is restored at deactivate.
- [ ] A reload round-trip test exists and passes.
