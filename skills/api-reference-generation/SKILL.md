---
name: api-reference-generation
description: Equips the advisor to audit generated API reference docs for completeness, accuracy, and developer usability.
---

# API Reference Generation

API reference documentation is generated from source (OpenAPI specs, doc comments, SDK signatures) and judged by whether a developer can call an endpoint without reading the implementation.
Review here means checking both the pipeline and the output: does the spec match the code, and does the rendered page answer the five questions every caller asks — auth, parameters, example, success, errors?

## Watch for
- Endpoints present in the router but missing from the spec, or spec entries with no implementation behind them
- Parameters without types, defaults, or required/optional marking
- Request/response examples that contradict the schema (wrong field names, impossible values)
- Missing error documentation: only 200 described, no 4xx/5xx codes or error body shape
- Auth requirements omitted or wrong (page says public, code demands a token)
- Enum values listed in prose but not in the schema, or vice versa
- Pagination, rate limits, and idempotency behavior left undocumented on list/create endpoints

## Best practices
- Generate reference from a single source of truth (OpenAPI 3.1 or typed doc comments); never hand-maintain parallel pages
- Validate the spec in CI (Spectral or equivalent) and fail on breaking schema changes without a version bump
- Require for every operation: method, path, auth, all parameters typed, one runnable request example, one success and one error response
- Document error bodies with the same rigor as success bodies, including whether the call is retryable
- Keep examples copy-pasteable: real curl/SDK calls with placeholder tokens clearly marked
- Mark deprecated fields with the replacement and the removal date
- Diff the rendered reference against the previous release to catch accidental exposure of internal endpoints

## Quick checklist
- [ ] Every implemented endpoint appears exactly once in the reference
- [ ] All parameters typed, with required/optional and defaults
- [ ] At least one runnable request example per operation
- [ ] Error codes and error body shapes documented
- [ ] Auth requirement stated and matching the code
- [ ] Deprecated fields annotated with replacement and date
- [ ] Spec validation passes in CI
