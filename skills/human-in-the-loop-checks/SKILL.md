---
name: human-in-the-loop-checks
description: Equips the advisor to verify AI systems are designed for effective human oversight per Article 14, with real intervention, override, and escalation capability.
---

# Human-in-the-Loop Checks

Article 14 of the EU AI Act requires high-risk systems to be designed for effective human oversight. Review distinguishes nominal from real oversight: a human who cannot understand, intervene, override, or stop the system is not oversight. Automation bias — rubber-stamping AI output — is the classic failure mode to probe.

## Watch for
- High-risk systems deployed without designed-in oversight measures (Article 14).
- "Human in the loop" claimed but no actual ability to intervene, override, or stop outputs.
- Automation bias unaddressed: operators conditioned to accept AI outputs uncritically.
- Oversight role undefined: no named responsibilities, competence requirements, authority, or escalation path.
- No mechanism to disregard, override, or reverse the system's output in individual cases.
- No routing rules sending low-confidence or high-stakes cases to mandatory human review.
- Oversight volume unrealistic: throughput too high for meaningful review.
- Human interventions and overrides not logged for accountability.

## Best practices
- Design oversight in from the start per Article 14: the system must let humans understand, monitor, interpret, and intervene.
- Define the oversight role explicitly: responsibilities, training, authority to override, escalation path.
- Implement concrete intervention mechanisms: reject/override controls, mandatory review queues, stop capability.
- Route low-confidence or high-stakes cases to human review by design, using stated confidence thresholds.
- Counter automation bias: training, disagreement prompts, periodic unaided calibration.
- Set realistic review volumes; flag when throughput makes meaningful oversight impossible.
- Log all human interventions and overrides for audit and post-market monitoring.
- Verify oversight actually happens: sample decisions and check for documented human involvement.

## Quick checklist
- [ ] Article 14 oversight measures designed in.
- [ ] Oversight role defined with authority.
- [ ] Override/stop mechanisms functional.
- [ ] Confidence-based routing to humans.
- [ ] Automation-bias countermeasures present.
- [ ] Review volume realistic.
- [ ] Interventions logged and audited.
