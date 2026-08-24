---
name: thread-pool-orchestration
description: Equips the advisor to evaluate pool sizing, blocking-call isolation, queue-depth policy, and shutdown ordering in thread-pool and async-runtime designs.
---

# Thread Pool Orchestration

Reviews how work is divided across CPU-bound and I/O-bound pools (rayon, tokio's blocking pool, Go worker pools, executor frameworks). Misconfiguration shows up as stalled async runtimes, nested-parallelism deadlocks, or silent queue growth under load.

## Watch for
- Blocking calls (DB, filesystem, mutex-heavy code) inside async tasks without `spawn_blocking` — stalls the whole tokio worker set.
- Pool sizes copied blindly: CPU-bound pools far above core count (thrashing) or I/O-bound pools sized at core count (starvation).
- Nested parallelism: rayon `par_iter` inside rayon work, or `spawn_blocking` code calling back into the async runtime — deadlock risk.
- Unbounded work queues in front of pools; backpressure must reject or block producers at a defined depth.
- No shutdown story: `shutdown()` without a drain timeout, or tasks dropped mid-write.
- One shared pool serving latency-critical requests next to bulk batch work — head-of-line blocking.
- Per-request thread creation (`std::thread::spawn` in the hot path) instead of a pool.
- Ignoring runtime warnings (tokio-console "blocking" reports) or letting unrelated workloads fight over rayon's global pool.

## Best practices
- CPU-bound: pool size ≈ physical core count (rayon's default is sound); I/O-bound: size from measured concurrency, often several times core count, capped by downstream limits.
- Isolate pools by latency class: interactive, batch, and maintenance work get separate executors.
- Bound every queue; define the rejection policy (backpressure, drop-oldest, error) and make it observable.
- Use `tokio::task::spawn_blocking` or a dedicated blocking pool; never `std::thread::sleep` on an async worker.
- Shutdown order: stop accepting → drain with a deadline → force-cancel; log exactly what was dropped.
- Prefer `std::thread::scope` for short-lived structured parallelism over manual join handles.
- Monitor queue depth, task wait time (queued → started), and pool saturation; alert before saturation reaches 100%.

## Quick checklist
- [ ] No blocking calls on async worker threads
- [ ] Pool size justified by workload class (CPU vs I/O)
- [ ] Queues bounded with an explicit full-queue policy
- [ ] Latency-critical and bulk work on separate pools
- [ ] No nested parallelism that can deadlock
- [ ] Shutdown drains with a deadline and logs drops
- [ ] Task wait-time and saturation metrics exist
