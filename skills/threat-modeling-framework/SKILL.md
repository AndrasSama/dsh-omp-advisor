---
name: threat-modeling-framework
description: Equips the advisor to structure threat models — assets, trust boundaries, STRIDE enumeration — and judge whether mitigations cover the real attack surface.
---

# Threat Modeling Frameworks

Threat modeling turns "is this secure?" from a vibe into an enumeration: decompose the system, name the trust boundaries, and walk each boundary with a structured set of threat categories (STRIDE).
A reviewer uses it both to build models for new features and to audit existing work — asking which threats were considered, which were dismissed, and whether the dismissals are defensible.

## Watch for
- Changes that cross a trust boundary (new API, new integration, new user input path) with no threat analysis at all
- STRIDE categories skipped: typically Repudiation (no audit log) and Information Disclosure (logs leaking secrets) go unexamined
- Mitigations placed on the wrong side of a boundary (client-side validation treated as a security control)
- Threats marked "accepted" with no named owner, risk rationale, or review date
- Data-flow diagrams missing: without them, threat enumeration is guesswork
- New agent/tool integrations modeled only for functionality, not for injection, excessive agency, or data exfiltration
- Threat models written once at design time and never revisited after scope changes

## Best practices
- Start with a data-flow diagram: identify data stores, processes, and every trust boundary (user→app, app→DB, service→service, model→tool)
- Apply STRIDE per boundary: Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege
- For each threat record: likelihood, impact, mitigation, and residual risk — use a simple matrix, not false precision
- Prioritize with attack trees on the crown-jewel assets (payment, PII, admin access, model tool execution)
- Treat risk acceptances as expiring decisions with an owner and a date
- Re-run the model when the diff adds inputs, permissions, integrations, or autonomy
- Convert each high threat into a testable requirement (a test that would fail if the mitigation regressed)

## Quick checklist
- [ ] Data-flow diagram with trust boundaries exists for the change
- [ ] All six STRIDE categories addressed per boundary
- [ ] Each mitigation sits server-side / on the correct boundary
- [ ] Risk acceptances have owner + review date
- [ ] Crown-jewel assets have attack trees or equivalent
- [ ] New input/permission/integration triggers a model update
- [ ] Top threats mapped to testable requirements
