---
name: memory-heap-profiling
description: Equips the advisor to diagnose Node.js heap growth, leaks, and retention chains using snapshots, allocation timelines, and RSS signals.
---

# Memory Heap Profiling

Heap problems in long-lived Node processes show up slowly — RSS creeping up, restarts getting frequent, OOM kills under load. Reviewers distinguish true leaks (growth that never plateaus) from healthy caches, and always trace a retention chain to its root before suggesting fixes.

## Watch for
- RSS/heapUsed climbing across requests and never releasing after idle.
- Unbounded Maps/arrays used as caches with no eviction or size cap.
- Listeners added per request without `removeListener` (EventEmitter leak warnings).
- Closures capturing large scopes kept alive by timers or globals.
- String concatenation in loops retaining huge buffers via slices.
- Global stores (module-level arrays, registries) growing with each session.
- `MaxListenersExceededWarning` in logs — a classic leak signature.
- Heap snapshots where the same constructor dominates retained size.

## Best practices
- Baseline first: take snapshots at idle, under load, and after idle again.
- Compare snapshots (growth view) to find what accumulated between them.
- Use allocation timelines to catch allocations that survive GC cycles.
- Cap every cache — LRU with max size and TTL, never a bare Map.
- Pair every `on`/`addListener` with removal tied to the same lifecycle.
- Check `process.memoryUsage()` trends in production, not just locally.
- Force `global.gc()` (with `--expose-gc`) during profiling to separate garbage from retention.
- Suspect native/buffer memory when RSS grows but JS heap stays flat.

## Quick checklist
- [ ] Growth pattern confirmed across idle→load→idle cycle.
- [ ] Snapshot comparison identifies the accumulating constructor.
- [ ] Retention chain traced from GC root to the leaked object.
- [ ] All caches have explicit size caps and eviction.
- [ ] Listener add/remove pairs verified on hot paths.
- [ ] No module-level collections growing per request/session.
- [ ] RSS vs JS-heap divergence checked for native memory.
- [ ] Fix verified by re-profiling, not assumed.
