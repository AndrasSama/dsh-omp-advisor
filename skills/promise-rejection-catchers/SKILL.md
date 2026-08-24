---
name: promise-rejection-catchers
description: Equips the advisor to find unhandled promise rejections, missing awaits, and error-swallowing catch blocks that crash or silently corrupt Node services.
---

# Promise Rejection Catchers

Since Node 15 an unhandled rejection crashes the process by default — but the worse failures are the silent ones: a missing `await`, a swallowed catch, a fire-and-forget promise whose error nobody sees. Reviewers trace every async call path to a handler and treat unobserved promises as defects.

## Watch for
- Async functions called without `await` and without `.catch()` (fire-and-forget).
- Empty or log-only `catch {}` blocks hiding real failures.
- `Promise.all` where one rejection abandons sibling work without cleanup.
- Event handlers declared `async` whose rejections no listener catches.
- `setTimeout`/`setInterval` callbacks using un-awaited async functions.
- Errors thrown in constructors or top-level module code during startup.
- `.then()` chains with no terminal `.catch()`.
- Rejection handlers that rethrow into nothing (process-level noise only).

## Best practices
- Every fire-and-forget promise gets an explicit `.catch()` with logging.
- Use `Promise.allSettled` when sibling tasks must survive one failure.
- Register `unhandledRejection`/`uncaughtException` hooks to log context, then fail fast deliberately.
- Wrap async event handlers: `emitter.on('x', (e) => void handler(e).catch(log))`.
- Make catch blocks either recover meaningfully or rethrow — never just swallow.
- Lint for floating promises (`no-floating-promises`, `require-await` where apt).
- Test failure paths: force rejections and assert the process state stays sane.
- Log the promise's operation name, not just the stack, for traceability.

## Quick checklist
- [ ] No floating promises: every async call awaited or caught.
- [ ] Catch blocks recover or rethrow — none silently swallow.
- [ ] `Promise.all` failure semantics match the intended cleanup.
- [ ] Async event/timer callbacks wrapped with error handling.
- [ ] Process-level rejection hooks log context and follow a policy.
- [ ] Lint rules catch floating promises in CI.
- [ ] Failure paths exercised in tests.
- [ ] Rejection logs identify the originating operation.
