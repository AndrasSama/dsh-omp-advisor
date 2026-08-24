---
name: zero-knowledge-logging
description: Equips the advisor to verify that logging pipelines capture auditable events without capturing personal identities or PII, using structured redaction by design.
---

# Zero-Knowledge Logging

Logs are the most common silent PII leak: request bodies, URLs with tokens, and error payloads carry identity into systems with weak access control. This skill reviews logging for a zero-knowledge posture — enough structure to audit what happened, without recording who someone is. It is an engineering discipline review, not a legal opinion.

## Watch for
- Full request/response bodies logged by default, including emails, names, and tokens.
- Identifiers in URLs or query strings (API keys, session IDs, user IDs) landing in access logs.
- Error handlers dumping stack traces with embedded user data.
- Free-text log fields where developers paste arbitrary context at runtime.
- Correlation that re-introduces identity: "anonymous" logs joinable to users via timestamps plus IPs.
- Log retention far beyond any audit need, with broader access than production data.
- No allowlist: logging relies on developers remembering what not to log.
- Third-party log/APM vendors receiving unredacted streams.

## Best practices
- Log events, not payloads: structured fields like action, resource type, outcome, duration — never raw bodies by default.
- Replace identities with opaque correlation IDs resolvable only through a separate, tightly controlled mapping.
- Enforce redaction at the logging-library level (allowlist plus scrubbers), not by developer discipline.
- Strip or hash query parameters and headers known to carry secrets before they reach sinks.
- Treat log access as production-data access: same authorization, auditing, and retention limits.
- Set explicit retention and verify deletion, including in downstream vendors.
- Test the pipeline: inject synthetic PII and confirm it never reaches any sink.
- Document what is deliberately logged and why, so reviewers can check necessity.

## Quick checklist
- [ ] No raw request/response bodies in default logging.
- [ ] URLs/headers scrubbed of tokens and identifiers.
- [ ] Error dumps verified free of user data.
- [ ] Redaction enforced in the logging layer, not ad hoc.
- [ ] Opaque correlation IDs used instead of user IDs.
- [ ] Log access control matches production data.
- [ ] Retention set and deletion verified.
- [ ] Synthetic-PII injection test passes end-to-end.
