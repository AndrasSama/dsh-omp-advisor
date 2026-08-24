---
name: sla-penalty-tracking
description: Equips the advisor to verify SLA definitions, measurement methods, service-credit math, and escalation remedies across contract documents.
---

# SLA & Penalty Tracking

SLA review checks that each service commitment is measurable, remedied, and enforceable. Weak SLAs fail in definition (no measurement method), in remedy (credits too small to matter), or in escalation (no exit for chronic failure). Verify uptime math directly — claimed percentages often don't match allowed downtime.

## Watch for
- SLA metrics defined without measurement method, source of truth, or measurement window.
- Service credits as the sole remedy, with no termination right for chronic failure.
- Credit caps too low (e.g., 5% of monthly fees) to create any real incentive.
- Exclusions so broad they swallow the SLA (unlimited scheduled maintenance, self-certified "customer-caused" issues).
- Uptime math errors: 99.9% allows ~43.8 minutes/month (~8.77 hours/year) of downtime; 99.99% allows ~52.6 minutes/year.
- Credit-claim windows too short, with forfeiture for late claims.
- No escalation path: no audit rights, remediation plans, or reporting obligations.
- Conflicting SLA terms across MSA, SOW, and exhibits with no hierarchy stated.

## Best practices
- For each SLA record: metric, definition, measurement method and window, reporting source, threshold, and remedy.
- Verify uptime percentages against downtime math before accepting them.
- Tier remedies: service credits → remediation plan → termination right for chronic breach.
- Size credit caps meaningfully (commonly 10–30% of affected monthly fees) and state whether they are exclusive remedies.
- Narrow exclusions: define scheduled maintenance with advance notice and an annual cap.
- Set reasonable credit-claim windows (e.g., 30 days from invoice) with a dispute mechanism.
- Include audit and reporting rights so the customer can independently verify compliance.
- Reconcile SLA terms across all contract documents and state which controls.

## Quick checklist
- [ ] Each SLA has metric + method + window + remedy.
- [ ] Uptime % verified against downtime math.
- [ ] Credit caps and remedy tiers reviewed.
- [ ] Exclusions narrow and defined.
- [ ] Claim window reasonable.
- [ ] Chronic-failure termination right present.
- [ ] Cross-document SLA conflicts resolved.
