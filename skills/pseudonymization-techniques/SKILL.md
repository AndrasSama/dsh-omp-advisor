---
name: pseudonymization-techniques
description: Equips the advisor to assess whether pseudonymization and anonymization claims are technically sound, key-managed, and correctly treated under GDPR.
---

# Pseudonymization Techniques

Pseudonymization (GDPR Article 4(5)) replaces identifiers so data cannot be attributed without additional information — but it remains personal data. Anonymization is a higher, risk-tested bar (Recital 26). Review challenges both claims: is the key actually separated, and could the "anonymized" set be re-identified by linkage?

## Watch for
- Pseudonymization conflated with anonymization — pseudonymous data is still personal data under GDPR.
- Tokenization where the re-identification key is stored alongside the pseudonymized data.
- Unsalted hashing of identifiers vulnerable to rainbow-table reversal.
- "Anonymized" datasets re-identifiable through quasi-identifier linkage (ZIP code, birth date, gender combinations).
- No access separation between pseudonymized data and the re-identification key.
- Pseudonymization claimed as a DPIA mitigation without technical specifics.
- Generalization/suppression insufficient for k-anonymity in shared datasets.
- No re-assessment of re-identification risk as datasets grow or are combined.

## Best practices
- Treat pseudonymized data as personal data: all GDPR obligations continue to apply.
- Separate and protect the re-identification key: different systems, strict access control, encryption.
- Use salted/peppered hashing or keyed tokens for identifiers; document the algorithm choice.
- Test anonymization claims against singling-out, linkability, and inference criteria (EDPB Opinion 05/2014 framework).
- Apply k-anonymity, l-diversity, or differential privacy with stated parameters for shared or analytics data.
- Document pseudonymization as a specific technical measure in DPIAs and RoPA security fields.
- Limit re-identification capability to named roles with audit logging.
- Re-assess re-identification risk periodically and whenever datasets are combined.

## Quick checklist
- [ ] Pseudonymous data treated as personal data.
- [ ] Key separated and access-controlled.
- [ ] Hashing salted or keyed appropriately.
- [ ] Anonymization claims risk-tested.
- [ ] k-anonymity/DP parameters stated.
- [ ] Measure documented in DPIA/RoPA.
- [ ] Re-identification risk re-assessed.
