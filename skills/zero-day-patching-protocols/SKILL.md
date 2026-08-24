---
name: zero-day-patching-protocols
description: Equips the advisor to review emergency patch triage, compensating controls, and post-patch verification for actively exploited vulnerabilities.
---

# Zero-Day Patching Protocols

Zero-day and actively exploited vulnerabilities compress normal patch cycles into hours, so triage, compensating controls, and verification must be pre-planned. The advisor reviews whether the organization can decide fast, protect exposed systems while patches are tested, and confirm the fix actually landed everywhere.

## Watch for
- No emergency change path: zero-day patches queued behind normal change-advisory cycles.
- Asset inventory gaps that make "are we affected?" unanswerable within hours.
- No compensating-control playbook (WAF rules, network isolation, feature disable) while patches are validated.
- Patching declared done on deployment percentage alone, without verifying exploit mitigation.
- Rollback plans missing for emergency patches that break production.
- Out-of-support systems in the estate with no documented exception or isolation.
- No after-action review capturing decision times and coverage gaps.
- Reliance on vendor advisories only, without monitoring active-exploitation feeds (e.g., CISA KEV).

## Best practices
- Pre-define an emergency patch track with delegated approval authority and time-boxed review.
- Keep an always-current asset and component inventory mapped to vulnerability applicability.
- Maintain a compensating-control menu per system class, ready to apply within hours.
- Prioritize by exploitation status (active exploitation / KEV listing) over CVSS score alone.
- Verify post-patch: version checks, exploit-mitigation tests, and coverage dashboards.
- Prepare rollback procedures and test them for critical systems.
- Isolate or retire end-of-life systems that cannot be patched; document exceptions.
- Run an after-action review within days, feeding fixes back into the protocol.

## Quick checklist
- [ ] Emergency patch track with delegated authority defined
- [ ] Asset inventory answers "are we affected?" fast
- [ ] Compensating controls pre-approved per system class
- [ ] Prioritization uses exploitation status
- [ ] Post-patch verification beyond install counts
- [ ] Rollback procedures tested
- [ ] EOL systems isolated or exceptioned
- [ ] After-action review scheduled post-incident
