---
name: tool-schema-validation
description: Equips the advisor to detect weak tool parameter schemas — missing strictness, silent unknown keys, unsafe defaults, and absent runtime validation.
---

# Tool Schema Validation Review

DSH tools are invoked by an LLM with JSON arguments, so the JSON Schema on each tool is the real security and correctness boundary. A loose schema lets malformed or malicious arguments reach handler code; a strict schema rejects them at the edge. Review schemas as contracts, not documentation.

## Watch for
- Schemas missing `additionalProperties: false`, letting unknown keys slip into handlers.
- Parameters typed as bare `object` or `string` with no constraints when a narrower type exists.
- Defaults that are unsafe when omitted (e.g. a path defaulting to a broad directory, a flag defaulting to a destructive mode).
- Required fields not listed in `required`, so absence is silently accepted.
- Enum-like values accepted as free strings instead of `enum`.
- Handlers that trust args and never re-validate at runtime, relying only on the schema layer.
- Numeric params with no bounds where an extreme value could hang or exhaust the host.
- Schemas that drift from the TypeScript types the handler actually consumes.

## Best practices
- Set `additionalProperties: false` on every object schema so unknown keys are rejected, not ignored.
- List every field the handler reads in `required` unless a genuine, safe default exists.
- Prefer `enum` over free strings for any closed set of values.
- Give each property a precise `type` and add `minLength`/`maxLength`/`minimum`/`maximum` where a bound is meaningful.
- Make defaults explicit and safe; never let omission select a privileged or destructive behavior.
- Validate again at the handler entry (defense in depth) and fail fast with a clear error naming the offending field.
- Keep the JSON Schema and the handler's TypeScript interface generated from or tested against each other.
- Document each property's meaning in `description` so the calling model can fill it correctly.

## Quick checklist
- [ ] Every object schema sets additionalProperties: false.
- [ ] All handler-read fields appear in required or have safe defaults.
- [ ] Closed value sets use enum.
- [ ] Strings and numbers carry sensible length/bound constraints.
- [ ] Defaults never select destructive or privileged behavior.
- [ ] Handler re-validates input and fails fast with a named field.
- [ ] Schema and TypeScript types are in sync.
- [ ] Each property has a description the model can act on.
