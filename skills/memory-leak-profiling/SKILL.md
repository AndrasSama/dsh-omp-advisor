---
name: memory-leak-profiling
description: Equips the advisor to evaluate profiling evidence and suspect unbounded growth in heaps, caches, and task/connection pools across Rust and Go services.
---

# Memory Leak Profiling

Covers the tooling and interpretation needed to diagnose RSS growth: heap profilers, allocation tracing, and the classic leak shapes (unbounded caches, leaked async tasks, `Arc` reference cycles, stuck goroutines). A reviewer should demand profile evidence, not guesses, before accepting any "fix".

## Watch for
- A fix submitted with no before/after profile — require the heaptrack / jeprof / pprof artifact that proves the leak and the fix.
- Profiling `inuse_space` when the symptom is GC churn, or `alloc_space` when the symptom is growth — use `inuse_space` for true growth, `alloc_space` for allocation rate.
- Rust suspects that ignore `Arc`/`Rc` reference cycles (especially with `RefCell`/`Mutex` interiors), which are never freed.
- Unbounded maps acting as caches (`HashMap` with no TTL or eviction) — the most common service "leak".
- Leaked tokio tasks: spawned futures holding channel receivers that never complete.
- Go: goroutine profile count climbing in lockstep with the heap — the leak is stuck goroutines, not objects.
- Comparing RSS across allocators (glibc vs jemalloc) without controlling for arena retention and fragmentation.
- Running Valgrind/DHAT on production-scale loads (100× slowdown) instead of sampled profiling on realistic traffic.

## Best practices
- Rust: `heaptrack ./bin` for full allocation traces; `MALLOC_CONF=prof:true,lg_prof_sample:19` plus `jeprof` for jemalloc-backed services; DHAT for bounded test runs.
- Go: `curl localhost:6060/debug/pprof/heap > h.out && go tool pprof -inuse_space h.out`; diff snapshots minutes apart with `pprof -base`.
- Establish a baseline: RSS at steady state, then its slope under constant load — flat is healthy, monotonic climb is a leak.
- Cap every long-lived cache: `lru` / `mini-moka` with max entries and TTL, metriced hit/evict counts.
- For Rust async, track live task counts and use `tokio-console` to find tasks that never complete.
- Break cycles with `Weak` references or explicit `Option::take()` slots in owner structs.
- Automate: CI soak test that fails when RSS grows beyond a threshold over N minutes at constant load.

## Quick checklist
- [ ] Profile artifact (heaptrack/jeprof/pprof) attached to the change
- [ ] inuse vs alloc space matches the symptom
- [ ] Every long-lived map has eviction or a size cap
- [ ] Arc/Weak audit done where shared ownership exists
- [ ] Async task count observable and bounded
- [ ] RSS baseline and slope measured under constant load
- [ ] Allocator/arena retention ruled out before blaming code
- [ ] Soak test with a memory assertion exists in CI
