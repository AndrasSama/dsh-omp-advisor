---
name: race-condition-audit
description: Equips the advisor to detect data races, TOCTOU check-then-act bugs, and atomic-ordering misuse, and to judge the test evidence that proves their absence.
---

# Race Condition Audit

Systematic review of concurrency correctness: data races (unsynchronized concurrent access), race conditions (logic-level ordering bugs), and the tooling that proves absence. The reviewer's question is "which interleaving breaks this?", not a linear read of the code.

## Watch for
- Check-then-act on shared state without atomicity: `if !map.contains_key(k) { map.insert(k, v) }` — classic TOCTOU; use the entry API or CAS.
- Double-checked locking on plain (non-atomic) fields without acquire/release and one-time-init semantics.
- Shared flags (e.g., `shutdown`) read outside the lock while writes happen under it.
- `RwLock` on write-heavy workloads — writer starvation or reader convoys; verify the lock mode fits the access pattern.
- Mutex poisoning policy undefined (`lock().unwrap()` after any panic elsewhere) — decide: propagate or recover.
- Filesystem TOCTOU: permission/symlink checks racing the open they guard.
- Tests that "usually pass" — flaky concurrency tests are bugs until proven otherwise; re-running to green is malpractice.
- No dynamic detector in the loop: missing `-race` (Go/TSan) or `loom`/`shuttle` (Rust) on the risky modules.

## Best practices
- Prefer ownership and message passing (channels, mpsc) over shared mutable state where the design allows.
- Make invalid states unrepresentable: bundle each flag with the data it guards inside one locked struct.
- Use atomics for counters/flags with documented ordering; entry API / `compute_if_absent` for map TOCTOU.
- Run TSan / `go test -race` on every CI run; `loom` for hand-rolled lock-free code; `shuttle` for randomized scheduling of critical paths.
- Stress tests: N×CPU threads with randomized yields, asserting invariants — not merely absence of panics.
- Document a global lock acquisition order wherever code holds 2+ locks; acquire in that order always.
- For filesystem TOCTOU, open first (with `O_NOFOLLOW`) and inspect via the fd (`fstat` on the handle).

## Quick checklist
- [ ] Every check-then-act on shared state is atomic (entry/CAS/under lock)
- [ ] No shared flag read outside its synchronization
- [ ] Lock ordering documented where 2+ locks coexist
- [ ] Dynamic race detector runs in CI on this module
- [ ] Flaky tests treated as bugs, never re-run to green
- [ ] Mutex poison policy explicit
- [ ] Filesystem checks performed on opened handles
- [ ] loom/shuttle covers hand-rolled synchronization
