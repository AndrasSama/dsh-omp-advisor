---
name: pii-redaction-filters
description: Equips the advisor to review PII redaction pipelines for coverage gaps, false negatives, and residual re-identification risk in logs and derived data.
---

# PII Redaction Filters

Redaction pipelines fail open: one missed pattern and PII flows into logs, analytics, and vendor systems. This skill reviews regex/NER-based redaction for what it misses, not just what it catches. Findings are engineering review flags; legal adequacy of any anonymization is a counsel question.

## Watch for
- Pattern-only redaction missing formats outside the regex set (international phone formats, emails in free text, IBANs).
- Free-text fields (support notes, search queries, error messages) passing through unredacted.
- NER models with unknown or untested recall on the actual data distribution.
- Redaction applied at display but not at storage: raw PII still persisted.
- Quasi-identifiers left intact (zip code, birth date, device ID) enabling re-identification when combined.
- Redaction bypass via encoding: URL-encoding, base64, Unicode lookalikes.
- No monitoring: silent filter failures or drift go unnoticed.
- Inconsistent redaction across sinks (logs scrubbed, metrics and traces not).

## Best practices
- Layer defenses: structured allowlisting first, regex second, NER for free text — and fail closed on uncertainty.
- Test with a labeled corpus of realistic synthetic data and track the false-negative rate as a metric.
- Redact at the earliest point in the pipeline, before any sink or vendor sees the data.
- Cover encodings: normalize or decode before matching, then redact.
- Treat quasi-identifiers as PII: generalize or suppress them based on re-identification risk.
- Monitor filter health: alert on pattern-match rate anomalies and periodically re-audit samples.
- Apply identical redaction to every sink: logs, metrics, traces, error reports, exports.
- Re-run the audit whenever schemas, formats, or models change.

## Quick checklist
- [ ] Redaction covers international format variants.
- [ ] Free-text fields pass through NER or are blocked.
- [ ] False-negative rate measured on a labeled corpus.
- [ ] Redaction at storage, not just display.
- [ ] Quasi-identifiers generalized or suppressed.
- [ ] Encoded payloads normalized before matching.
- [ ] Filter health monitored with alerts.
- [ ] All sinks covered identically.
