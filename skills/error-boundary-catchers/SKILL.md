---
name: error-boundary-catchers
description: Equips the advisor to detect missing error containment — exceptions thrown across the host boundary, uncaught handler crashes, and errors not folded into RPC results.
---

# Error Boundary Catchers Review

A DSH plugin must never take down the host. Every entry point the host calls — tool handlers, RPC methods, lifecycle hooks — is a boundary where exceptions must be caught and converted into structured results. Reviewers verify that no plugin error can escape as an uncaught throw into host code.

## Watch for
- Tool or RPC handlers whose body can throw and are not wrapped in a try/catch.
- Errors thrown across the host boundary instead of returned as a failure result.
- Async handlers with no `.catch`/try-catch, producing unhandled promise rejections.
- Catch blocks that swallow the error silently with no logging and no failure signal.
- Error objects that lose the original message/stack when re-wrapped.
- RPC failures returned as success-shaped responses with an error buried in a field the caller ignores.
- Lifecycle hooks (activate/deactivate) that throw and abort the host's whole plugin loop.
- Missing distinction between user-facing error messages and internal diagnostic detail.

## Best practices
- Wrap every host-invoked entry point in a boundary try/catch that converts throws into structured error results.
- Return failures in the RPC result shape the caller is documented to check; never throw across the boundary.
- Attach `.catch` to every detached promise, or route through a helper that does.
- Log the full error internally, but return a safe, user-appropriate message.
- Preserve the original cause/stack when wrapping errors so debugging is not lossy.
- Make deactivate cleanup individually try/caught so one failure cannot abort teardown.
- Distinguish retryable from fatal errors in the result so callers can react correctly.
- Add tests that force a handler to throw and assert the host receives a clean error result, not a crash.

## Quick checklist
- [ ] Every host-invoked handler is wrapped in a boundary try/catch.
- [ ] Failures are returned as structured results, never thrown across the boundary.
- [ ] All detached promises carry a catch handler.
- [ ] No catch block silently swallows an error.
- [ ] Wrapped errors preserve the original cause/stack.
- [ ] RPC errors surface in the field the caller actually checks.
- [ ] Lifecycle hook failures cannot abort the host plugin loop.
- [ ] A forced-throw test confirms clean error containment.
