---
name: secret-rotation-verification
description: Equips the advisor to verify that secrets are rotatable, actually rotated on schedule or exposure, and fully revoked after a leak.
---

# Secret Rotation Verification

A secret's risk is a function of its blast radius and its lifetime; rotation is the control that bounds both.
Reviewing rotation means checking three things: can the secret be rotated without downtime, is rotation actually triggered (schedule or exposure), and after a leak is the old value truly revoked everywhere it was cached or replicated.

## Watch for
- Secrets with no rotation mechanism: long-lived API keys embedded in configs with no documented replacement path
- Leaked secrets "fixed" by adding a new one while the old one stays valid (caches, replicas, git history still hold it)
- Rotation that requires downtime or a deploy, so it never happens
- Cached credentials with TTLs longer than the rotation period (stale secrets keep working)
- Shared secrets across services/environments — rotating one breaks others, so nobody rotates
- Service account keys or PATs with no expiry and no owner
- Secrets deleted from files but never revoked after git-history exposure

## Best practices
- Prefer short-lived, auto-issued credentials (OIDC federation, instance roles, Vault dynamic secrets) over static keys
- Every static secret has: an owner, an expiry, a rotation runbook, and a tested zero-downtime rotation path
- Support dual-secret overlap: new value deployed and verified before the old one is revoked
- On any suspected leak: revoke first, rotate second, then purge or rotate everywhere the value was cached or logged
- Set credential TTLs shorter than the rotation interval so expiry forces the cycle
- Alert on secret age (key older than policy allows) and on use of near-expiry credentials
- Verify revocation end-to-end: after rotation, confirm the old credential is rejected by the real service, not just deleted from config

## Quick checklist
- [ ] Every secret in the change has an owner and expiry
- [ ] Rotation path exists and works without downtime
- [ ] Dual-value overlap supported during rotation
- [ ] Leaked values revoked at the source, not just replaced in config
- [ ] Cache/replica TTLs shorter than rotation period
- [ ] Git-history exposure handled by revocation, not just file deletion
- [ ] Post-rotation test confirms old credential rejected
