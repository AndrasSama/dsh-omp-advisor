---
name: explainability-requirements
description: Equips the advisor to verify AI systems provide explainability proportionate to risk, including GDPR Article 22 safeguards and AI Act Article 13 transparency.
---

# Explainability Requirements

Explainability review checks whether AI outputs can be interpreted by the people who must act on them — deployers under AI Act Article 13, affected individuals under GDPR Articles 13–15 and 22(3). Method choice matters (interpretable models vs post-hoc SHAP/LIME/counterfactuals), and explanations must be faithful, audience-appropriate, and connected to human oversight.

## Watch for
- High-risk systems with no interpretability or explainability measures despite Article 13's transparency-to-deployers requirement.
- "Black box" asserted without attempting post-hoc explanation methods (SHAP, LIME, counterfactuals, feature attribution).
- Explanations mismatched to audience: technical dumps for non-technical users, or none at all.
- Automated decisions with legal or similarly significant effects under GDPR Article 22 lacking the Article 22(3) safeguards: human intervention, expressing one's point of view, contesting the decision.
- Explanation coverage partial: only high-confidence outputs explained, edge cases opaque.
- No documentation of how explanations are generated or of their own limitations.
- Explanation faithfulness untested — do they reflect the model's actual decision process?
- No link between explanations and human oversight workflows.

## Best practices
- Match the approach to risk and audience: global (model-level) explanations for auditors, local (per-decision) for affected individuals and operators.
- Prefer inherently interpretable models where feasible; otherwise use post-hoc methods with stated limitations.
- For GDPR Article 22 decisions, implement Article 22(3) safeguards and provide meaningful information about the logic involved (Articles 13–15).
- Document explanation methods, assumptions, and known failure modes.
- Test explanation faithfulness and stability; flag approximations as such.
- Connect explanations to oversight: operators must be able to use them to intervene (Article 14).
- Deliver explanations at decision time, not only on request.
- Retain explanation artifacts (method, version, parameters) for audit reproducibility.

## Quick checklist
- [ ] Explainability measures match risk tier.
- [ ] Method chosen and limitations stated.
- [ ] GDPR Article 22 safeguards implemented.
- [ ] Explanations audience-appropriate.
- [ ] Faithfulness tested.
- [ ] Linked to human-oversight workflow.
- [ ] Explanation artifacts retained for audit.
