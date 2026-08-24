---
name: database-anonymization-scripts
description: Equips the advisor to review database anonymization for why naive masking fails, whether k-anonymity targets are met, and how resistant outputs are to re-identification.
---

# Database Anonymization Scripts

Swapping names for fake names is not anonymization: quasi-identifiers, correlations, and background knowledge routinely re-identify "masked" datasets. This skill reviews anonymization scripts and their outputs against re-identification reality. Findings are technical review flags; legal adequacy of anonymization is a counsel question.

## Watch for
- Direct identifiers removed but quasi-identifiers (zip, birth date, sex, timestamps) left intact at full precision.
- Deterministic pseudonymization with a guessable or reused mapping — effectively a reversible encoding.
- Masking applied inconsistently: one table anonymized, joinable tables not, re-linking identities.
- No k-anonymity (or stronger model) target, or the target unverified on the actual output.
- Free-text fields (notes, descriptions) passing through untouched with embedded identifiers.
- Temporal precision retained: exact timestamps enabling linkage with external events.
- No adversary testing: output never attacked with linkage or inference attempts.
- "Anonymized" copies retained with the same access controls and retention as the original.

## Best practices
- Inventory identifiers and quasi-identifiers first; classify each column by re-identification risk.
- Generalize or suppress quasi-identifiers (age bands, region prefixes, coarsened timestamps) to hit a verified k-anonymity target; consider l-diversity or t-closeness for sensitive attributes.
- Use salted, keyed, non-guessable transformations for pseudonymization and protect the mapping separately — or destroy it if re-linking is not needed.
- Apply identical treatment across all joinable tables, or break the join keys.
- Scrub free text with redaction pipelines or exclude it.
- Validate on the output: measure equivalence-class sizes and run linkage attacks against realistic auxiliary data.
- Consider synthetic data generation when analytical utility matters more than row-level fidelity — and validate it too.
- Treat released copies as permanent: apply the strictest threat model because recall is impossible.

## Quick checklist
- [ ] All identifier/quasi-identifier columns inventoried.
- [ ] Quasi-identifiers generalized to a verified k target.
- [ ] Pseudonymization non-guessable, mapping protected or destroyed.
- [ ] Joinable tables treated consistently.
- [ ] Free-text fields scrubbed or excluded.
- [ ] Timestamps and rare values coarsened.
- [ ] Output attacked with linkage/inference tests.
- [ ] Release treated as permanent under the strictest threat model.
