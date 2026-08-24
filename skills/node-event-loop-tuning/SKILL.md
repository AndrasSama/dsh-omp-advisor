---
name: node-event-loop-tuning
description: Equips the advisor to spot event-loop stalls, blocking calls, and phase-imbalance problems that degrade Node.js throughput and tail latency.
---

# Node Event Loop Tuning

The event loop is Node's single most important runtime contract: any synchronous stall delays every other request on that thread. Reviewers watch for code that blocks the loop, measures its phases, and keeps callbacks short enough that p99 latency stays flat under load.

## Watch for
- Synchronous fs/crypto calls (`readFileSync`, `pbkdf2Sync`) on hot request paths.
- Large JSON parse/stringify or heavy loops running inline in a handler.
- Timers with very short intervals (`setInterval(fn, 1)`) starving I/O callbacks.
- `process.nextTick` recursion that starves the poll phase.
- Event-loop lag climbing while CPU usage stays low (blocked sync work, not load).
- Microtask loops (`await` in tight recursion) deferring I/O indefinitely.
- Native addons or regex (catastrophic backtracking) holding the thread.
- Long GC pauses from heap pressure showing up as loop lag spikes.

## Best practices
- Measure with `perf_hooks.monitorEventLoopDelay()` before tuning anything.
- Push CPU-heavy work to `worker_threads`, a thread pool, or a separate service.
- Prefer async fs/stream APIs; chunk large parses instead of one giant buffer.
- Keep `nextTick` queues bounded; prefer `setImmediate` for fair scheduling.
- Set `UV_THREADPOOL_SIZE` deliberately when fs/dns/crypto pool contention appears.
- Alert on p99 loop lag, not averages — stalls hide in the tail.
- Test with realistic payload sizes; tiny dev payloads never reveal parse stalls.
- Profile under load (`clinic doctor`, `0x`) to attribute lag to its phase.

## Quick checklist
- [ ] No sync fs/crypto/JSON work on request paths.
- [ ] Event-loop delay is measured and alerted on (p99).
- [ ] CPU-bound work is delegated off the main thread.
- [ ] Timer and `nextTick` usage cannot starve the poll phase.
- [ ] Threadpool size matches concurrent fs/dns/crypto demand.
- [ ] Regexes on user input are bounded against backtracking.
- [ ] Load tests use production-sized payloads.
- [ ] GC pauses are correlated with loop-lag spikes before tuning.
