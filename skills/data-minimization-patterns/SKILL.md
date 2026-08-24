---
name: data-minimization-patterns
description: Equips the advisor to detect over-collection of personal data in schemas, APIs, and forms and to enforce purpose-bound, field-level minimization per GDPR Article 5(1)(c).
---

# Data Minimization Patterns

GDPR Article 5(1)(c) requires personal data to be adequate, relevant, and limited to what is necessary for the stated purposes — and most over-collection hides in plain sight as "we might need it later" fields. This skill trains the advisor to audit schemas, endpoints, and forms field by field. Findings are engineering review flags, not legal advice.

## Watch for
- Forms or APIs collecting fields no stated purpose justifies (date of birth for a newsletter, phone number for a download).
- "Collect everything" schemas: generic JSON blobs or wide tables accumulating PII without review.
- Optional fields that are functionally mandatory, or required fields with no stated purpose.
- Third-party SDKs and analytics silently harvesting device or behavioral data beyond the feature's need.
- Logs, error reports, or telemetry carrying PII because the data model leaks into them.
- Data retained "just in case" with no deletion plan.
- Purpose drift: data collected for billing reused for profiling without a basis.
- Duplicate PII copies across services with no single owner.

## Best practices
- For every field, demand answers: what purpose does this serve, and can the feature work without it?
- Audit at the schema level: review each column and key in tables and API payloads that touch personal data.
- Default to not collecting; add fields only with a documented purpose binding.
- Push processing to the edge: compute aggregates client-side or use tokens/references instead of raw PII.
- Review third-party SDK data flows in the same audit; vendor collection counts as your collection.
- Separate identities: use opaque IDs and join tables instead of denormalized PII.
- Re-audit on every schema migration or new integration, not just at project start.
- Pair minimization with retention: every kept field needs an expiry story.

## Quick checklist
- [ ] Every PII field has a documented, current purpose.
- [ ] No field collected "just in case".
- [ ] Optional fields genuinely optional.
- [ ] Third-party SDK collection reviewed and scoped.
- [ ] Logs/telemetry verified free of PII.
- [ ] No purpose drift into new processing.
- [ ] PII stored once, referenced by opaque ID elsewhere.
- [ ] Schema changes trigger a minimization re-review.
