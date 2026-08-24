---
name: ransomware-recovery-plans
description: Equips the advisor to verify immutable/offline backup strategies, restore drills, recovery prioritization, and segmentation that supports recovery from ransomware.
---

# Ransomware Recovery Plans

Ransomware recovery depends on backups the attacker cannot reach, rehearsed restoration, and a prioritized sequence for bringing services back. Plans that look complete on paper routinely fail at restore time due to untested backups, missing credentials, or domain controllers that must come back first. The advisor stress-tests the plan against a realistic encryption-plus-exfiltration scenario.

## Watch for
- Backups reachable from the production network with the same credentials (encryptable by the attacker).
- No immutable, air-gapped, or offline copy tier in the backup architecture.
- Restore drills never run, or run only against trivial file-level restores.
- No documented recovery order: identity, DNS, and core data services sequenced after dependent apps.
- Backup admin accounts lacking MFA or sharing credentials with production admin.
- No plan for the double-extortion case (data exfiltrated, backups intact but trust broken).
- Recovery objectives (RTO/RPO) stated but never validated against actual restore times.
- Flat network design allowing lateral movement to re-infect restored systems.

## Best practices
- Maintain at least one immutable or offline backup copy, logically separated from production credentials.
- Protect backup infrastructure with separate accounts, MFA, and monitoring.
- Run full-system restore drills on a schedule and record measured RTO/RPO.
- Document a recovery sequence starting with identity, DNS, and certificate services.
- Segment recovery environments so restored systems can be validated before reconnection.
- Include decision criteria for the exfiltration scenario: legal, notification, and communication steps.
- Verify integrity of restored data (checksums, application-level validation).
- Rehearse the plan with IT, security, legal, and comms together, not just the backup team.

## Quick checklist
- [ ] Immutable/offline backup tier exists and verified
- [ ] Backup infra isolated with separate credentials and MFA
- [ ] Full restore drills run on schedule with measured times
- [ ] Recovery sequence documented (identity/DNS first)
- [ ] Recovery environment segmented for validation
- [ ] Exfiltration scenario decision path defined
- [ ] Restored data integrity checks in place
- [ ] Cross-functional rehearsal completed
