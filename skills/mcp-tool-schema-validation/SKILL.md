---
name: mcp-tool-schema-validation
description: Equips the advisor to check MCP tool arguments against declared schemas — required fields, types, enums, malformed JSON — and flag silent default abuse.
---

# MCP Tool Schema Validation

MCP tools declare JSON Schemas for their arguments, and servers vary wildly in how strictly they enforce them. This discipline covers validating each call against the declared contract — before it fires, and again whenever a server rejects it. The most expensive failures are not rejections but silent ones: a missing field that defaults to `recursive: true`, a string `"5"` coerced to a number, an unknown enum value quietly ignored.

## Watch for
- Missing required fields that the server may silently default rather than reject
- Type mismatches: numeric strings where integers are declared, objects where strings are expected, arrays where scalars are declared
- Values outside declared enums — servers may reject, coerce, or ignore them depending on implementation
- Malformed or partial JSON inside string-typed fields that are documented to carry JSON payloads
- Omitted optional fields with dangerous defaults: `recursive`, `force`, `overwrite`, `dry_run=false`, `mode:"replace"`
- Unknown or undeclared fields passed to schemas with `additionalProperties: false`
- Guessed enum values or parameter names instead of reading the declared schema in the tool definition
- Repeated schema violations across calls — evidence the agent never internalized the tool contract and is guessing each time

## Best practices
- Read the tool's declared schema from the tool definition before the first call, not after the first validation error
- Supply every behavior-critical field explicitly; never rely on server-side defaults for semantics that matter
- Name dangerous defaults explicitly: pass `recursive:false`, `dry_run:true`, `force:false` even when the fields are optional
- Match declared types exactly — do not send `"5"` where `5` is declared, even if the server happens to be lenient
- On a validation error, fix the arguments from the schema and the error message; never retry the identical payload
- Validate nested structures against `items`, `additionalProperties`, and `oneOf` rules before sending
- When a schema is ambiguous or undocumented, probe with the cheapest read-only call first to learn the contract

## Quick checklist
- [ ] Are all required fields present in every call?
- [ ] Do argument types match the declared schema exactly?
- [ ] Are all enum values drawn from the declared set?
- [ ] Any undeclared extra fields in the payload?
- [ ] Are dangerous defaults explicitly overridden?
- [ ] Do JSON-in-string fields actually parse?
- [ ] After a validation error, did the agent fix the args rather than retry them?
