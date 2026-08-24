---
name: sql-injection-defense
description: Equips the advisor to spot SQL injection vectors — string-built queries, ORM raw escapes, and second-order injection — and verify parameterized defenses.
---

# SQL Injection Defense

SQL injection review is mechanical if you know where to look: any place user-controlled text is concatenated, interpolated, or formatted into SQL.
Modern ORMs hide most of it, which makes the escape hatches — raw queries, literal fragments, dynamic identifiers — the highest-value review targets, and second-order injection (stored now, executed later) is the variant most reviewers miss.

## Watch for
- String interpolation/concatenation into SQL: f-strings, template literals, String.format with SELECT/INSERT/UPDATE
- ORM escape hatches: Sequelize.literal, Knex.raw, Django .raw()/.extra(), SQLAlchemy text() with interpolated values
- Dynamic identifiers (table/column names, ORDER BY, LIMIT) built from user input — parameterization cannot bind identifiers
- Second-order paths: user input stored in the DB and later spliced into a query by another component
- LIKE clauses without wildcard escaping (% and _ in user input change query semantics)
- Search/filter builders that assemble WHERE clauses from arbitrary client-supplied field names
- Stored procedures called with concatenated arguments instead of bound parameters

## Best practices
- Parameterize everything: placeholders for all values, always — no exceptions for "internal" queries
- For dynamic identifiers, whitelist against a known set of allowed table/column names in code
- Escape LIKE wildcards on user input before binding, or use the database's escape function
- Keep raw-SQL usage grep-able and require a review annotation justifying its safety
- Apply least-privilege DB accounts: the app user should not have DDL or cross-schema rights
- Add SAST rules that fail on string-built SQL (Semgrep taint mode is effective here)
- Test with classic payloads (' OR 1=1-- and unicode variants) on every input that reaches a query

## Quick checklist
- [ ] No interpolation/concatenation inside any SQL string in the diff
- [ ] ORM raw/literal calls use bound parameters, not formatted values
- [ ] Dynamic identifiers validated against a whitelist
- [ ] Stored user data never spliced into later queries unparameterized
- [ ] LIKE inputs wildcard-escaped
- [ ] DB account is least-privilege
- [ ] Injection payloads covered by tests on touched inputs
