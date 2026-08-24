---
name: api-serialization-standards
description: Equips the advisor to enforce consistent, versioned API response contracts — explicit serializer fields, stable error envelopes, and no accidental data leakage.
---

# API Serialization Standards

Serializers define the public contract of a service. A sloppy serializer leaks internal fields, drifts from the documented schema, or returns ad-hoc error shapes that clients cannot parse reliably. Reviews should treat every serializer change as a contract change.

## Watch for
- `fields = '__all__'` on serializers exposed to external clients.
- Returning raw model instances or `model_to_dict` output instead of a serializer.
- Different error shapes across endpoints (bare strings vs dicts vs lists).
- Renaming or removing response fields without a version bump or deprecation window.
- Nested writable serializers with no depth limit, allowing unbounded payloads.
- `SerializerMethodField` doing a hidden per-row query.
- One serializer reused for request validation and response rendering with optional fields everywhere.
- Timestamps, enums, or money serialized inconsistently (string here, number there).

## Best practices
- Whitelist fields explicitly; never ship `__all__` on public endpoints.
- Separate read serializers from write serializers; input schemas are usually narrower than output.
- Standardize one error envelope (e.g. `{ "error": { "code", "message", "details" } }`) across the whole API.
- Version contracts via URL prefix or header, and keep old versions serving until sunset.
- Document every field's type, nullability, and format in OpenAPI generated from code.
- Keep `SerializerMethodField` cheap and precomputed (annotate the queryset) rather than querying per object.
- Use stable machine-readable error codes; human messages are supplementary.
- Contract-test each endpoint against its schema in CI so drift fails the build.

## Quick checklist
- [ ] Every public serializer lists fields explicitly.
- [ ] Read and write serializers are separated where shapes differ.
- [ ] All errors return the standard envelope with a machine-readable code.
- [ ] No field was renamed/removed without versioning or deprecation.
- [ ] Nested serializer depth is bounded and documented.
- [ ] `SerializerMethodField`s are backed by annotations, not per-row queries.
- [ ] Timestamp/enum/money formats are consistent across endpoints.
- [ ] The OpenAPI spec is generated from code and verified in CI.
