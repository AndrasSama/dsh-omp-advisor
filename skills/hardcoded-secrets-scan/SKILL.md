---
name: hardcoded-secrets-scan
description: Equips the advisor to detect secrets committed in code — keys, tokens, and passwords in source, poor env discipline, and mishandled false positives.
---

# Hardcoded Secrets Scan

Secrets in source are a leak the moment they are committed: history keeps them even after deletion. Reviewers scan for credentials in code and config, verify secrets come from secure environment or secret storage, and know how to triage scanner hits without waving real findings through as false positives.

## Watch for
- Literal API keys, tokens, passwords, or private keys assigned in source or config files.
- Long high-entropy strings (base64/hex blobs) embedded in code, URLs, or connection strings.
- Credentials baked into example files, tests, or fixtures that point at real services.
- Secrets read from env but with a real default value in code as a fallback.
- Connection strings or URLs containing embedded `user:password@` components.
- Secrets logged, echoed in error messages, or injected into prompts and telemetry.
- Scanner suppressions (`nosec`, allowlists) added without a recorded justification.
- A "fixed" secret that was only moved, not rotated, after being committed.

## Best practices
- Load all credentials from environment variables or a secret manager; never inline them.
- Keep real values out of examples, tests, and fixtures; use obviously fake placeholders.
- Never give a secret-bearing variable a real default in code.
- Strip credentials from connection strings and build them from parts at runtime.
- Keep secrets out of logs, errors, prompts, and telemetry by scrubbing before output.
- Require a written justification for every scanner suppression and review each one.
- On any committed secret, rotate it first, then purge history; moving it is not a fix.
- Run a secrets scanner in CI so new secrets are blocked at merge, not found later.

## Quick checklist
- [ ] No literal keys/tokens/passwords in source or config.
- [ ] High-entropy strings are inspected and explained.
- [ ] Examples/tests use fake placeholders, not real credentials.
- [ ] No secret variable carries a real default value.
- [ ] Connection strings contain no embedded credentials.
- [ ] Secrets never reach logs, errors, or prompts.
- [ ] Every scanner suppression has a reviewed justification.
- [ ] Any committed secret is rotated, not just moved.
