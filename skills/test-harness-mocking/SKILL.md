---
name: test-harness-mocking
description: Equips the advisor to detect unhealthy test mocking — over-mocked hosts, non-deterministic tests, leaked fake timers, and stubs that diverge from real APIs.
---

# Test Harness Mocking Review

DSH plugin tests run against a mock host because the real host is heavy and stateful. Mocking is a trade-off: too little and tests are flaky and slow; too much and they verify the mock instead of the plugin. Reviewers judge whether each stub is faithful, necessary, deterministic, and cleaned up.

## Watch for
- Mocks that reimplement host logic with different behavior, so tests pass but production fails.
- Over-mocking where the test asserts on the stub's calls more than on real outcomes.
- Fake timers installed but never restored, leaking into later tests.
- Async mocks that resolve synchronously (or vice versa) and hide real timing bugs.
- Shared mutable mock state reused across tests without reset.
- Stubs with no assertion or expectation, existing only to silence errors.
- Mocks that swallow exceptions the real host would surface.
- Tests that depend on wall-clock time, random values, or real network without a deterministic substitute.

## Best practices
- Keep mocks behaviorally faithful to the host contract; mirror error cases and async semantics.
- Mock at the boundary (host API surface), not inside the plugin's own modules.
- Install and restore fake timers in setup/teardown so they never leak between tests.
- Reset all shared mock state in a beforeEach/afterEach hook.
- Every stub should have a reason; remove stubs that are never asserted or exercised.
- Let real errors propagate through mocks unless the test is specifically about error handling.
- Replace wall-clock, random, and network dependencies with seeded or fake equivalents.
- Periodically run a subset of tests against a real or integration host to catch mock drift.

## Quick checklist
- [ ] Mocks match the real host contract, including errors and async.
- [ ] Mocking happens at the host boundary, not inside plugin internals.
- [ ] Fake timers are installed and restored per test.
- [ ] Shared mock state is reset between tests.
- [ ] No orphan stubs that are never used or asserted.
- [ ] Real exceptions are not silently swallowed by mocks.
- [ ] Time, randomness, and network are made deterministic.
- [ ] An integration check guards against mock drift.
