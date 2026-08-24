---
name: pydantic-validation-rules
description: Equips the advisor to enforce clean Pydantic boundaries — strict field types, explicit validators, and no leakage of Any/dict into validated models.
---

# Pydantic Validation Rules

Pydantic models are the trust boundary between external input and internal logic. When that boundary is porous — `Any` fields, silent coercion, validators that swallow errors — invalid data reaches business logic and fails far from its source. Reviews should check that every field is typed, constrained, and validated where it enters.

## Watch for
- Fields typed `Any`, `dict`, or bare `object` on request models.
- `extra="allow"` on public input schemas.
- Stringly-typed fields where `Enum`, `Literal`, or constrained types fit.
- Validators that catch exceptions and return defaults silently.
- Rules enforced only in validator code instead of typed constraints (`gt`, `min_length`, patterns).
- One mega-model reused for create, update, and response with everything Optional.
- `model_validate` skipped — code constructing models from raw dicts field by field.
- Datetimes accepted as naive strings with no timezone policy.

## Best practices
- Type every field precisely; use `Enum`/`Literal` for closed sets and annotated constraints for ranges and lengths.
- Set `extra="forbid"` on input schemas so unknown fields fail fast.
- Prefer declarative constraints; reserve `@field_validator`/`@model_validator` for cross-field rules.
- Split models by role: `XCreate`, `XUpdate` (fields optional), `XRead` — never one shape for all.
- Enforce timezone-aware datetimes (`AwareDatetime`) at the boundary.
- Let validation errors propagate as 422s with full error detail; never swallow them.
- Use `StrictStr`/`StrictInt` or strict mode where silent coercion would hide client bugs.
- Keep models pure data: no DB access or I/O inside validators.

## Quick checklist
- [ ] No `Any`/bare-`dict` fields on input models.
- [ ] Input schemas use `extra="forbid"`.
- [ ] Closed value sets are Enums or Literals.
- [ ] Range/length/format rules use typed constraints, not ad-hoc code.
- [ ] Create/Update/Read shapes are separate models.
- [ ] Datetimes are timezone-aware at the boundary.
- [ ] Validators never swallow errors or return silent defaults.
- [ ] Models contain no I/O or DB access.
