---
name: async-state-machines
description: Equips the advisor to evaluate cancellation safety, pinning correctness, and state-transition hygiene in Rust async code and explicit state machines.
---

# Async State Machines

Reviews async control flow — `select!`, hand-rolled `Future`s, and explicit state enums — where cancellation and polling semantics create subtle bugs. Most production async defects are cancellation-unsafe awaits or state machines with unreachable or stuck states.

## Watch for
- `tokio::select!` over non-cancellation-safe futures (e.g., a recv into a reused buffer, or a write mid-frame) — losing the race drops or corrupts data.
- `select!` without `biased;` when branch priority matters (shutdown must beat work).
- Hand-rolled `Future::poll` returning `Pending` without registering the `Waker` — the task hangs forever.
- Self-referential state moved after pinning, or `Unpin` asserted incorrectly on pinned types.
- Blocking calls (`std::thread::sleep`, sync I/O) inside async fns — stalls the executor.
- State transitions scattered across ad-hoc match arms with no single transition table — missing-state bugs.
- Busy loops via `yield_now().await` instead of event-driven wakeups.
- Dropping a mid-flight future that holds a lock guard or a half-sent message — cancellation leaks resources.

## Best practices
- Audit every `select!` branch against the cancellation-safety docs of the awaited call; wrap unsafe ones so losing the race is harmless.
- Use `biased;` and order branches deliberately: shutdown/drain first, then I/O.
- Model protocols as explicit enums plus one `transition(event) -> State` function; log every transition.
- For hand-rolled futures: store the `Waker`, re-register on every `Pending`, and test spurious wakeups.
- Prefer `async fn` and combinators over manual `Future` impls unless profiling shows the need.
- Make cleanup cancellation-safe with drop guards and finally-style patterns around resource acquisition.
- Use `tokio-console` to find tasks stuck idle or never polled again.
- Apply timeouts at the driver level of the state machine, not inside every state.

## Quick checklist
- [ ] Every select! branch cancellation-safe or safely wrapped
- [ ] Branch priority explicit (biased) where order matters
- [ ] Every Pending registers a Waker
- [ ] No blocking calls inside async context
- [ ] State transitions centralized and logged
- [ ] Drop/cleanup paths handle mid-flight cancellation
- [ ] Timeouts applied at the driver level
- [ ] tokio-console confirms no stuck tasks
