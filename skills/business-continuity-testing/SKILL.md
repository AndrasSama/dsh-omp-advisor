---
name: business-continuity-testing
description: Equips the advisor to review disaster-recovery and continuity plans for untested assumptions — stale backups, unmeasured RTO/RPO, and failover paths that exist only on paper.
---

# Business Continuity Testing

A continuity plan that has never been exercised is a hypothesis, not a capability. Reviewers treat backups, failover, and recovery procedures as code: they must be tested against realistic failure scenarios, measured against declared RTO/RPO, and re-tested after every significant change.

## Watch for
- Backups configured but never restored — no restore test on record.
- RTO/RPO declared to stakeholders but never measured in an actual drill.
- Failover procedures that depend on one person's tribal knowledge.
- Recovery runbooks stale relative to the current architecture.
- Backup retention or encryption settings that would fail compliance or recovery needs.
- Single points of failure (one region, one DNS provider, one key person) with no workaround.
- Drills limited to happy-path scenarios, never partial or cascading failures.
- No post-drill review capturing what broke and what was fixed.

## Best practices
- Restore-test backups on a schedule; a backup without a verified restore does not count.
- Run game-day drills for realistic scenarios: region loss, data corruption, ransomware, key-person absence.
- Measure RTO/RPO during drills and reconcile with what was promised to the business.
- Keep runbooks executable: step-by-step, current, and runnable by someone other than the author.
- Automate recovery where possible; manual-only recovery degrades under real incident stress.
- Test partial failures and cascades, not just total outage.
- Hold a post-drill review; track every gap to closure before the next drill.
- Re-test after architecture changes — every significant change invalidates old assumptions.

## Quick checklist
- [ ] Backups restore-tested on schedule with recorded results.
- [ ] RTO/RPO measured in drills, not just declared.
- [ ] Runbooks current and executable by non-authors.
- [ ] Drills cover partial and cascading failure scenarios.
- [ ] No unmitigated single points of failure for critical paths.
- [ ] Recovery automation covers the most time-critical steps.
- [ ] Post-drill gaps tracked to closure.
- [ ] Continuity re-tested after significant architecture changes.
