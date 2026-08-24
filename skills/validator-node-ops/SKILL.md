---
name: validator-node-ops
description: Equips the advisor to evaluate validator operations — key security, double-sign prevention, peer topology, and upgrade/backup procedures.
---

# Validator Node Operations

Reviews how a validator is run: key handling, sentry topology, sync strategy, and upgrade discipline. Operational mistakes here are slashing events — double-signing from duplicated keys, or downtime from untested upgrades.

## Watch for
- `priv_validator_key.json` stored on machines with broad access, in git, or unencrypted at rest.
- The same validator key configured on two nodes simultaneously (test + prod) — guaranteed double-sign on any overlap.
- Validator exposed directly to public P2P without sentry nodes — trivially eclipsed or DDoSed.
- No `halt-height` upgrade drill: binaries swapped live at upgrade height with no rollback plan.
- `priv_validator_state.json` not backed up — restoring without it risks double-signing on replayed heights.
- Seeds/`persistent_peers` pointing at a single provider — network partition risk.
- No missed-block alerting; jailings discovered after the fact.
- State sync used on the validator itself instead of a trusted full-node/sentry path.

## Best practices
- Sentry architecture: public sentries relay to a hidden validator; restrict validator P2P to sentry IPs only.
- Keep the signing key on minimal-footprint hardware; file perms 0600, encrypted offline backups.
- One key, one active signer — enforce procedurally and monitor for duplicate signatures.
- Back up `priv_validator_key.json` and `priv_validator_state.json` on every change; test restores.
- Drill upgrades on testnet; use `halt-height` for coordinated stops and verify the version hash before restart.
- Alert on missed blocks (per signing window), peer count drops, and block lag versus sentries.
- Diversify seeds and persistent peers across operators.
- Document incident runbooks: key compromise, double-sign detection, emergency unbond.

## Quick checklist
- [ ] Signing key access minimized and encrypted
- [ ] Key provably active on exactly one node
- [ ] Sentry topology hides validator from public P2P
- [ ] Key + state files backed up and restore-tested
- [ ] halt-height upgrade procedure drilled
- [ ] Missed-block and lag alerts live
- [ ] Peer diversity across operators
- [ ] Incident runbooks written
