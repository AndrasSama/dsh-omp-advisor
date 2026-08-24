---
name: ttl-expiration-enforcement
description: Equips the advisor to verify that data retention limits are actually enforced — expiry scheduled, deletion verified, backups included — rather than merely documented.
---

# TTL & Expiration Enforcement

Retention policies that exist only in documents are not controls: data outlives its purpose in caches, replicas, and backups unless expiry is engineered and verified. This skill reviews TTL enforcement end to end. Findings are engineering review flags; the retention period itself is a legal/business decision to confirm, not invent.

## Watch for
- Retention stated in policy but no TTL column, index TTL, or scheduled purge in the actual system.
- "Soft delete" treated as deletion: rows flagged but still queryable and restorable indefinitely.
- Backups and disaster-recovery copies retained far beyond primary data expiry.
- Caches, search indexes, and analytics copies with no expiry aligned to the source.
- Purge jobs that silently fail: no monitoring, no alerting, no reconciliation.
- Legal-hold handling absent or ad hoc: holds neither respected nor released.
- TTLs applied inconsistently across duplicated stores of the same data.
- No proof of deletion: nobody can demonstrate that expiry actually happened.

## Best practices
- For each data class, trace: where it lives (all copies), its TTL, the enforcing mechanism, and the verification.
- Prefer native expiry (database TTLs, object lifecycle rules) over bespoke cron jobs where available.
- Make deletion real: hard-delete or irreversibly anonymize, covering every replica, cache, and index.
- Include backups in the retention model: rotation must guarantee expired data ages out of all backup generations.
- Monitor purge jobs: alert on failure and reconcile counts periodically.
- Implement legal holds explicitly: pause expiry for held records and resume on release.
- Log deletion events (metadata only) to provide auditable proof without re-collecting PII.
- Test expiry end-to-end on a schedule, not just at launch.

## Quick checklist
- [ ] Every data class has an enforced TTL mechanism.
- [ ] All copies enumerated: primary, replicas, caches, indexes, analytics.
- [ ] Deletion is hard-delete or irreversible anonymization.
- [ ] Backups age out within the retention window.
- [ ] Purge jobs monitored with failure alerts.
- [ ] Legal holds pause and resume expiry correctly.
- [ ] Deletion proof (metadata logs) available.
- [ ] End-to-end expiry test performed recently.
