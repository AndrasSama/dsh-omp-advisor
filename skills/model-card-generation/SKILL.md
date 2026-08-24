---
name: model-card-generation
description: Equips the advisor to assess whether model cards document intended use, subgroup performance, training data, limitations, and maintenance with deployable specificity.
---

# Model Card Generation

Model cards are the standard documentation artifact for model capabilities, limits, and provenance. Deployers and auditors rely on them to decide whether a model fits a use case. Review checks for the sections that carry real risk information — out-of-scope uses, subgroup performance, limitations — not just the presence of a document.

## Watch for
- Intended use stated but out-of-scope uses missing — the boundary deployers most need.
- Performance reported only as aggregate metrics without subgroup breakdowns.
- Training data described vaguely ("web data") without sources, collection method, or filtering.
- Limitations section empty or boilerplate.
- Evaluation details not reproducible: benchmarks, versions, and conditions unspecified.
- Ethical considerations absent or generic.
- No versioning: model version, training date, and change log missing.
- No maintenance information: owner, contact, update cadence, deprecation policy.

## Best practices
- Follow the established structure: model details, intended use, out-of-scope use, training data, evaluation, performance, limitations, ethical considerations, maintenance.
- State intended and explicitly out-of-scope uses; downstream deployers rely on this boundary.
- Report performance disaggregated by relevant subgroups and conditions; name benchmark versions.
- Describe training data with sources, collection period, preprocessing, and filtering criteria.
- Write specific limitations and failure modes with known risks and mitigations — never boilerplate.
- Include version, training date, model type, and license; maintain a change log.
- Document evaluation methodology so results are reproducible.
- Name owners and contact points; state update and deprecation policy.

## Quick checklist
- [ ] Intended and out-of-scope uses stated.
- [ ] Subgroup performance reported.
- [ ] Training data sources described.
- [ ] Limitations specific and honest.
- [ ] Evaluation reproducible (benchmarks, versions).
- [ ] Version and change log present.
- [ ] Ownership and contact info listed.
