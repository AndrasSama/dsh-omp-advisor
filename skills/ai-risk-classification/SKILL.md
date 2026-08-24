---
name: ai-risk-classification
description: Equips the advisor to verify AI systems are correctly classified under the EU AI Act's risk tiers, including Annex III screening and GPAI obligations.
---

# AI Risk Classification

The EU AI Act (Regulation (EU) 2024/1689) sorts systems into risk tiers — prohibited (Article 5), high-risk (Article 6 with Annexes I and III), transparency-risk (Article 50), and minimal — each carrying different obligations. Misclassification is the root compliance failure: everything downstream (logging, oversight, monitoring) follows the tier. Review checks the classification decision itself, against actual use.

## Watch for
- AI systems deployed with no documented risk classification at all.
- Annex III high-risk use cases missed: biometrics, critical infrastructure, education, employment, essential services, law enforcement, migration, justice.
- Article 6(3) derogation claimed (Annex III system deemed not high-risk) without a documented assessment of why no significant risk arises.
- General-purpose AI model obligations (Chapter V, Article 53+) ignored for systems built on foundation models.
- Classification performed once and never revisited as the use case changes.
- Intended-purpose drift: marketed for low-risk use, deployed in a high-risk context.
- No record of the classification decision or its reasoning.
- Treating the AI Act as exhaustive when sectoral rules (and GDPR) also apply.

## Best practices
- Classify every system against the four tiers before deployment and document the decision with reasoning.
- Check Annex III categories against the actual use case, not the marketing label.
- If relying on Article 6(3), document the no-significant-risk assessment and register the system where required.
- For GPAI-based systems, identify provider vs deployer obligations (Article 53 for providers; systemic-risk tier at 10^25 FLOPs training compute).
- Re-classify on material change: new use case, new data, new users, new geography.
- Track applicability dates: prohibitions from 2 Feb 2025, GPAI duties from 2 Aug 2025, most high-risk duties from 2 Aug 2026.
- Map overlapping regimes (GDPR, sectoral law) alongside the AI Act.
- Escalate borderline cases to legal review rather than self-classifying downward.

## Quick checklist
- [ ] Risk tier assigned and documented.
- [ ] Annex III checked against actual use.
- [ ] Article 6(3) assessment documented if used.
- [ ] GPAI obligations identified if applicable.
- [ ] Re-classification triggers defined.
- [ ] Applicability dates checked.
- [ ] Overlapping regimes mapped.
