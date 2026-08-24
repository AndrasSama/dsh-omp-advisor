---
name: parallel-call-orchestration
description: Equips the advisor to spot independent tool calls made sequentially that should be batched in parallel, and dependent calls wrongly parallelized.
---

# Parallel Call Orchestration

Independent tool calls issued one-per-turn serialize latency that the runtime would happily run concurrently; dependent calls issued together produce garbage or races. This discipline covers reading the dependency graph behind a transcript segment and checking the parallel/sequential choice against it. The rule is simple: no data dependency → batch in one block; any consumed output → serialize.

## Watch for
- Multiple independent reads/searches/lookups issued one-per-turn when they could share a single assistant block
- Sequential subagent launches for independent tasks — each spawned only after the previous one settled
- Dependent calls parallelized: call B references a placeholder, guess, or stale value for call A's unknown result
- Concurrent writes to the same file or resource — last-writer-wins races and interleaved edits
- Parallel mutations whose order matters: migrations, sequenced API steps, setup-then-use sequences
- Fan-outs that exceed a server's concurrency or rate limits, producing 429/timeout storms
- False dependencies: calls serialized "to be safe" when they only share read-only state
- Parallelism for its own sake: tiny micro-calls batched where coordination overhead exceeds the latency saved

## Best practices
- Batch all independent calls in one assistant turn: reads, greps, web lookups, independent subagents — same block, no waiting between
- Parallelize only when no call consumes another's output; state the dependency explicitly before choosing
- Serialize all mutations to shared state; parallelize reads freely
- Chunk fan-outs to stay under the target server's concurrency and rate limits; add backoff at the edges
- Use pipeline semantics for per-item multi-stage work (no barrier between stages); reserve barriers for stages that genuinely need all results
- Launch independent background subagents together in one message, then keep doing useful work while they run
- When in doubt about independence, sequence — a wasted parallel round costs more than a serialized one

## Quick checklist
- [ ] Any 2+ independent calls issued sequentially?
- [ ] Any parallel call consuming another parallel call's output?
- [ ] Any concurrent writes to the same target?
- [ ] Are fan-outs within the server's concurrency/rate limits?
- [ ] Any sequential waiting that one batch would have eliminated?
- [ ] Is the parallel/sequential choice justified by the dependency graph?
- [ ] Any independent subagents launched one at a time?
