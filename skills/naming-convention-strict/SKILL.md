---
name: naming-convention-strict
description: Equips the advisor to enforce consistent naming across identifiers, files, and modules so the codebase stays greppable, predictable, and self-documenting.
---

# Strict Naming Conventions

Naming is the cheapest documentation a codebase has — and the first thing to rot. Reviewers enforce one convention per identifier class, flag names that lie about their content, and protect grep-ability: a concept should be spelled exactly one way everywhere.

## Watch for
- Mixed conventions for the same class (camelCase next to snake_case variables).
- Boolean names that read as values (`data`, `result`) instead of predicates.
- Abbreviations used inconsistently (`btn`/`button`, `mgr`/`manager`) across files.
- File names that do not match their primary export or module purpose.
- Single-letter names outside tiny loop/index scopes.
- Names encoding stale state (`newService`, `tempHandler`, `util2`).
- Verb/noun confusion: functions named like data, variables named like actions.
- The same concept spelled differently in two layers (`userId` vs `user_id` vs `uid`).

## Best practices
- Codify one rule per class: types PascalCase, functions/vars camelCase, constants SCREAMING_SNAKE, files kebab-case (or the repo's established set).
- Name booleans as assertions: `isEnabled`, `hasAccess`, `shouldRetry`.
- Prefer one full spelling per concept project-wide; document allowed abbreviations.
- Align file name with default/primary export; one module, one clear name.
- Rename on purpose in its own commit so review can focus on the mapping.
- Let the linter enforce what it can (casing rules) and review what it cannot (semantics).
- Match names to the domain glossary; new terms get added to it deliberately.
- Delete or rename stale qualifiers (`new`, `old`, `tmp`) once they stop being true.

## Quick checklist
- [ ] Identifier classes follow the project's single convention set.
- [ ] Booleans named as predicates, not bare nouns.
- [ ] Abbreviations consistent and on the approved list.
- [ ] File names match their primary export/purpose.
- [ ] No single-letter names outside narrow loop scopes.
- [ ] Stale qualifiers (`new`/`temp`/`util2`) removed or renamed.
- [ ] Cross-layer spellings of one concept unified.
- [ ] Casing enforced by lint rules in CI.
