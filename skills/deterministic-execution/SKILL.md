---
name: deterministic-execution
description: Equips the advisor to detect nondeterminism sources in consensus-critical code — floats, map iteration, wall-clock time, goroutines, and non-canonical serialization.
---

# Deterministic Execution

Reviews consensus-path code for anything that can diverge between validators running identical inputs. One nondeterministic read produces different app hashes, and the chain halts or forks — the highest-severity class of appchain bug.

## Watch for
- Floating-point arithmetic anywhere in the state machine (rounding differs across hardware/compilers) — use integer/decimal types.
- Go map iteration feeding state writes, event order, or gas usage.
- `time.Now()`, `time.Since`, or timers in handlers instead of `ctx.BlockTime()`.
- Unseeded or OS-seeded randomness (`math/rand` default source, `crypto/rand` reads) in consensus paths.
- Goroutines whose completion order affects state or events.
- Serialization relying on field insertion order rather than canonical ordering; map keys serialized unsorted.
- Locale-, timezone-, or platform-dependent formatting (float formatting, string collation).
- Reading environment (hostname, env vars, file paths) inside state transitions.

## Best practices
- Integer-only token/state math (`sdkmath.Int`, fixed-point with explicit scale); forbid floats via lint.
- Iterate only ordered stores; sort slices with a total, stable comparator before any state effect.
- Derive all time from block headers; derive randomness from committed beacon/VDF values if needed at all.
- Keep consensus code single-threaded in effect: no goroutine results feeding state.
- Canonical serialization: protobuf with fixed field numbers, sorted map keys, no dependence on unknown fields.
- Replay tests: re-execute recorded blocks across builds/platforms and compare app hashes.
- CI matrix across OS/arch for the state-machine package with hash-comparison of outputs.
- Lint gates (custom vet passes) flagging `time.Now`, float ops, and map ranging in consensus packages.

## Quick checklist
- [ ] No float arithmetic in the state machine
- [ ] No map iteration affecting state/events
- [ ] Time only from block context
- [ ] No nondeterministic randomness
- [ ] No goroutine-order dependence
- [ ] Serialization canonical and version-pinned
- [ ] Block replay hash-comparison tests exist
- [ ] Lint gates consensus packages
