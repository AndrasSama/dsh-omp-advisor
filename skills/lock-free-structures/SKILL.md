---
name: lock-free-structures
description: Equips the advisor to detect memory-ordering bugs, ABA hazards, reclamation gaps, and unjustified lock-free complexity in concurrent data-structure code.
---

# Lock-Free Structures

Covers review of lock-free and wait-free code (atomics, crossbeam, ring buffers) where correctness hinges on memory ordering and safe reclamation. Lock-free is only justified under measured contention; much "lock-free" code in review is both slower and subtly wrong.

## Watch for
- `Ordering::Relaxed` on atomics that publish data — publication needs `Release` on the write side and `Acquire` on the read side at minimum.
- CAS retry loops with no backoff (`std::hint::spin_loop` or exponential) — hot loops burn CPU and starve sibling threads.
- ABA hazards on compare-and-swap of pointers or indices without a tagged generation counter.
- Node reclamation while readers may still hold references: missing epoch-based reclamation (`crossbeam::epoch`) or hazard pointers.
- False sharing: independent hot counters on one cache line — require padding (`#[repr(align(64))]`).
- Lock-free queue chosen "because faster" at low contention, where a `Mutex` is measurably faster and simpler.
- `SeqCst` everywhere "to be safe" — often a throughput cliff; demand a per-atomic ordering justification.
- Busy-wait consumers on ring buffers in latency-sensitive paths instead of park/notify.

## Best practices
- Default to `Mutex`/`RwLock`; reach for lock-free only with profile evidence of lock contention at the target throughput.
- Use vetted crates: `crossbeam-queue` (SegQueue, ArrayQueue), `crossbeam-skiplist`, `rtrb`/`ringbuf` for SPSC paths.
- Document the happens-before story for every atomic: what data does this ordering publish, and to whom?
- Batch under contention: per-thread local accumulation flushed periodically beats per-event CAS.
- Validate hand-rolled atomics with `loom` (systematic concurrency exploration) before shipping.
- Pad hot atomics to cache-line boundaries; separate read-mostly from write-hot fields.
- Benchmark against the Mutex baseline under realistic contention before keeping any lock-free code.

## Quick checklist
- [ ] Every Acquire has a matching Release publishing real data
- [ ] CAS loops include backoff
- [ ] Reclamation strategy (epoch/hazard/ownership) explicit
- [ ] ABA considered for pointer/index CAS
- [ ] Hot fields cache-line padded
- [ ] Lock-free choice justified by measured contention
- [ ] loom or equivalent model tests cover hand-rolled atomics
- [ ] Throughput compared against a Mutex baseline
