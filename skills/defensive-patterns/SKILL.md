---
name: defensive-patterns
description: Equips the advisor to detect missing defensive coding — absent guard clauses, unvalidated input, fail-open behavior, and skipped type narrowing.
---

# Defensive Patterns Review

Defensive coding means handling the bad case before the happy case: validate inputs at the edge, guard preconditions early, and fail closed when something is wrong. In a plugin host, an unvalidated value can travel far before it explodes. Reviewers check that each function protects itself instead of trusting its callers.

## Watch for
- Functions that use parameters without checking for null/undefined/wrong type first.
- Deeply nested "arrow" logic where early-return guards would flatten the happy path.
- Fail-open behavior: on error or unknown input the code proceeds with a permissive default.
- Values from external sources (args, files, RPC) used without validation or type narrowing.
- Optional chaining that papers over a missing value instead of handling the absent case.
- Type assertions (`as`) used to skip narrowing rather than to encode a verified fact.
- Array/object access without bounds or existence checks on externally shaped data.
- Error handling that converts a failure into a silent success.

## Best practices
- Validate and normalize inputs at the function boundary, before any real work.
- Use guard clauses to return early on bad input, keeping the main path un-nested.
- Fail closed: on error or unknown input, stop and surface the problem rather than proceeding permissively.
- Narrow external values with explicit checks or a validator before use.
- Prefer handling the absent case explicitly over optional-chaining into a default.
- Use type assertions only after a runtime check has made the assertion true.
- Check bounds/existence before indexing into externally shaped arrays or objects.
- Make failures visible: return or throw a clear error instead of degrading to silent success.

## Quick checklist
- [ ] Inputs are validated/normalized at the boundary.
- [ ] Guard clauses return early on bad input.
- [ ] Behavior fails closed, not open, on error.
- [ ] External values are narrowed before use.
- [ ] Absent cases are handled, not optional-chained away.
- [ ] Type assertions follow real runtime checks.
- [ ] Indexing into external data is bounds-checked.
- [ ] Failures surface clearly instead of becoming silent success.
