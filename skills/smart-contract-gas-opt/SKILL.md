---
name: smart-contract-gas-opt
description: Equips the advisor to evaluate CosmWasm/SDK contract gas consumption — storage access patterns, loop bounds, and metering pitfalls.
---

# Smart Contract Gas Optimization

Reviews gas efficiency in CosmWasm contracts and SDK modules where every storage read/write and loop iteration is metered. Gas bugs are DoS vectors: a message that exceeds block gas can never execute, locking funds or functionality.

## Watch for
- Repeated reads of the same storage key in one execution — cache in memory after the first load.
- Loops over unbounded state (all delegators, all entries) inside a single message — past N entries the message becomes unexecutable.
- Storage keys built from long or unbounded strings — cost and bloat; prefer compact binary keys.
- Deep serialization of large structs per write when a field-level update would do.
- Events emitting large payloads — charged by gas and bloats blocks.
- Submessages used where direct calls suffice (reply overhead), or missing where rollback boundaries are needed.
- Gas simulated only at toy state size: tested with 10 entries, deployed with 10k.
- Instantiation doing unbounded work (airdrop loops over all recipients in Instantiate).

## Best practices
- Read-once pattern: load into a local struct, mutate, write once; batch writes at the end of execution.
- Paginate anything user-facing: process N entries per message with a continuation key; keep per-message gas bounded.
- Use compact keys (big-endian u64 bytes) and short prefixes; avoid JSON-encoded keys.
- Simulate gas at production state scale (seed testnets with realistic entry counts) and set limits with headroom.
- Move bulk work into Execute messages triggered over time, or scheduled per-block processing with fixed budgets.
- Emit minimal events: ids and amounts, not full objects.
- Profile with wasmvm gas reports / SDK `GasMeter` traces to find hot spots before micro-optimizing.
- Watch contract size against the chain's wasm size limit — dedup dependencies, strip debug symbols.

## Quick checklist
- [ ] No repeated reads of the same key
- [ ] All loops bounded or paginated
- [ ] Storage keys compact and fixed-size where possible
- [ ] Gas simulated at production state scale
- [ ] Events minimal
- [ ] Bulk work split across messages/blocks
- [ ] Submessage boundaries deliberate
- [ ] Contract size within chain limits
