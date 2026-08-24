---
name: state-machine-transitions
description: Equips the advisor to evaluate appchain state transition code for determinism, phase ordering, migration coverage, and genesis replay correctness.
---

# State Machine Transitions

Reviews how chain state changes across BeginBlock, message delivery, and EndBlock. Transition bugs are the worst class: nondeterminism forks the chain, missing migrations halt it at upgrade height, and broken export/import loses state silently.

## Watch for
- Go map iteration in consensus-path code — random order causes app-hash divergence across validators.
- `time.Now()`, `rand`, or goroutine results feeding state — only block time and deterministic sources are allowed.
- Missing `RegisterMigration` for a module whose store layout changed — the chain halts at upgrade height.
- EndBlock logic depending on BeginBlock side effects of the same height without explicit ordering.
- State writes that change event emission order — event ordering matters to indexers.
- `ExportGenesis` not round-tripping: export must import into a fresh chain and reproduce app hashes.
- Transitions skipping validation on "trusted" internal calls — internal paths need the same invariant checks.
- Store key prefix collisions between modules or across versions.

## Best practices
- Iterate only via ordered store iterators (KVStore prefix iterators are sorted); collect-and-sort any aggregated data.
- Use `ctx.BlockTime()`/`ctx.BlockHeight()` exclusively; derive any randomness from committed, deterministic sources.
- Write a migration handler for every store schema change; test the upgrade path from N-1 state.
- Keep BeginBlock → DeliverTx → EndBlock data flow explicit; document cross-module reads per phase.
- Round-trip test: export genesis at height H, import, run blocks, compare app hashes.
- Namespace store keys centrally; review every new prefix registration for collisions.
- Validate internal-call inputs with the same rigor as external messages.
- Property-test transition invariants (supply conservation, ordering guarantees).

## Quick checklist
- [ ] No Go map iteration in consensus paths
- [ ] No wall clock or nondeterministic rand in handlers
- [ ] Migration registered for every store change
- [ ] Begin/EndBlock ordering documented
- [ ] Export/import round-trip verified
- [ ] Store prefixes collision-checked
- [ ] Internal calls validated
- [ ] Transition invariants property-tested
