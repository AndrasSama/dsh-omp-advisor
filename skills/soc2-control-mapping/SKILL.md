---
name: soc2-control-mapping
description: Equips the advisor to map controls to SOC 2 Trust Services Criteria, identify evidence gaps, and flag control deficiencies before an audit.
---

# SOC 2 Control Mapping

SOC 2 reports on controls relevant to the Trust Services Criteria — Security is mandatory; Availability, Processing Integrity, Confidentiality, and Privacy are optional additions. Mapping means linking each criterion to implemented controls and to the evidence proving operation over the audit period. The advisor reviews mapping completeness and evidence strength.

## Watch for
- Criteria claimed in scope with no mapped controls ("narrative-only" coverage).
- Controls described but with no evidence artifacts (tickets, logs, sign-offs).
- Point-in-time evidence offered for a period-of-time (Type II) requirement.
- Controls mapped to multiple criteria but evidence collected once and not reusable as described.
- Complementary user-entity controls (CUECs) assumed performed by the customer without documentation.
- New systems, acquisitions, or services launched mid-period and excluded from the mapping.
- Control owners unaware they own evidence production.
- Exceptions found late with no remediation window before the report period ends.

## Best practices
- Start from the criteria in scope and map every applicable point to at least one control.
- For each control, define the evidence artifact, its source system, and collection frequency.
- Distinguish design (Type I) from operating-effectiveness (Type II) evidence needs.
- Automate evidence collection where possible: IAM exports, ticket-system queries, CI logs.
- Document CUECs and subservice-organization complementary controls clearly.
- Assign named owners per control and review evidence monthly, not just pre-audit.
- Run an internal readiness gap assessment and remediate before the observation period.
- Track exceptions with root cause and corrective action, not just fixes.

## Quick checklist
- [ ] Every in-scope criterion mapped to controls
- [ ] Every control has defined evidence artifacts
- [ ] Evidence spans the full observation period
- [ ] Collection automated or scheduled
- [ ] CUECs documented and communicated
- [ ] Mid-period changes incorporated into scope
- [ ] Control owners assigned and aware
- [ ] Gap assessment completed pre-audit
