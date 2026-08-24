---
name: bias-mitigation-frameworks
description: Equips the advisor to assess whether fairness claims are backed by defined metrics, subgroup evaluation, proxy analysis, and production monitoring.
---

# Bias Mitigation Frameworks

Bias review checks whether fairness is engineered and measured, not asserted. That means a chosen fairness metric, disaggregated evaluation, representativeness assessment, and ongoing monitoring as data drifts. Review also verifies that trade-offs between fairness and accuracy are disclosed rather than hidden.

## Watch for
- Fairness claimed without a defined metric (demographic parity, equalized odds, equal opportunity, calibration) or justification of the choice.
- Evaluation reported only as aggregate accuracy, hiding subgroup disparities.
- Protected attributes (or valid proxies) not collected, making disparity measurement impossible.
- Training-data representativeness never assessed; known under-representation unmitigated.
- No disparate-impact analysis — note the four-fifths (80%) rule is a US employment-selection heuristic, not a universal legal threshold; jurisdiction-dependent.
- Bias testing done once pre-launch with no production monitoring as data drifts.
- Proxy discrimination unexamined: features correlated with protected attributes (ZIP code, names) left in place.
- Mitigations applied without documenting the fairness-accuracy trade-off.

## Best practices
- Select and document fairness metric(s) appropriate to the use case and harm type; conflicting metrics require an explicit, justified choice.
- Disaggregate evaluation by relevant subgroups and report performance gaps, not just aggregates.
- Assess training-data representativeness and document known gaps and their likely direction of harm.
- Test for proxy discrimination: identify features correlated with protected attributes and assess their contribution to outcomes.
- Apply mitigations at the right stage: pre-processing (reweighting, resampling), in-processing (constrained optimization), or post-processing (threshold adjustment).
- Monitor fairness in production with drift detection on subgroup performance.
- Document trade-offs: what accuracy changed, what fairness improved, and who approved.
- Align with AI Act high-risk duties (Article 10 data governance, Article 15 accuracy/robustness) and sectoral anti-discrimination law.

## Quick checklist
- [ ] Fairness metric(s) defined and justified.
- [ ] Subgroup evaluation reported.
- [ ] Data representativeness assessed.
- [ ] Proxy features examined.
- [ ] Mitigation stage and method documented.
- [ ] Production fairness monitoring in place.
- [ ] Trade-offs disclosed.
