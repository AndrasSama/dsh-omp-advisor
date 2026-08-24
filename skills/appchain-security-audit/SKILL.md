---
name: appchain-security-audit
description: Equips the advisor to audit appchain modules for panic DoS vectors, unbounded state growth, permission leaks, and supply invariant violations.
---

# Appchain Security Audit

Security review of Cosmos SDK modules and chain configuration: panic handling, unbounded iteration, keeper permissions, and supply invariants. On an appchain, one panicking message or unbounded loop is a chain-halt event, not just a bug.

## Watch for
- Unrecovered `panic` reachable from user-controlled messages — one malformed tx halts consensus for all validators.
- Unbounded state iteration in handlers (ranging a prefix store with user-controlled count) — block gas exhaustion.
- Swallowed errors (`_ = store.Set(...)` or ignored returns) hiding failed writes.
- Module accounts with `Minter`/`Burner` reachable from unpermissioned message paths.
- Missing or bypassable replay protection (account sequence checks disabled, custom AnteHandler skipping signature verification).
- Params changeable via governance without bounds checks (e.g., inflation settable to arbitrary values).
- Integer handling: unsigned subtraction underflow or unchecked multiplication in token math.
- Events emitting unbounded user data — bloats blocks and breaks indexers.

## Best practices
- Convert panics to errors in all tx paths; reserve panic for truly unreachable invariants; fuzz with malformed inputs.
- Bound every loop: paginate, cap with params, or charge gas proportional to iteration; use prefix iterators with limits.
- Check every error; wrap with context (`errorsmod.Wrap`); register module error codes.
- Use `sdkmath.Int` and safe arithmetic helpers for token math; test overflow/underflow boundaries.
- Gate privileged operations behind authority checks (governance module account as the authority for param changes).
- Register invariants (`RegisterInvariants`) for supply conservation and run them in simulation.
- Cap event attribute sizes; avoid emitting full user payloads.
- Fuzz message handlers and the AnteHandler with go-fuzz-style harnesses before mainnet.

## Quick checklist
- [ ] No user-reachable panics in tx paths
- [ ] All state iteration bounded or gas-metered
- [ ] No ignored error returns
- [ ] Mint/burn paths require authority
- [ ] Replay/sequence protection verified end-to-end
- [ ] Governance params have range validation
- [ ] Token math uses safe integer types with edge tests
- [ ] Invariants registered and simulated
