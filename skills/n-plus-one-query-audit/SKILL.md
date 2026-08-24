---
name: n-plus-one-query-audit
description: Equips the advisor to detect N+1 query patterns — per-row queries in loops, ORM lazy-load traps, and missing query-count assertions in tests.
---

# N+1 Query Audit

The N+1 pattern — one query for the list, one per row for a relation — is the most common ORM performance bug, and it is invisible on small test data. Auditing means tracing every serialization path for lazy loads and pinning query counts in tests so regressions fail loudly.

## Watch for
- Attribute access on related objects inside a loop over a queryset or result set.
- Serializers calling `obj.related_set.all()` per object without prefetch.
- Lazy-loaded relationships touched in templates, GraphQL resolvers, or list comprehensions.
- `for` loops calling `.get()` or `.filter().first()` with a changing key.
- Query counts that scale linearly with input size in test logs.
- Model properties or hybrid properties that issue queries when read.
- Bulk endpoints (exports, reports) built by iterating and saving one row at a time.
- GraphQL or nested REST endpoints with no dataloader/prefetch strategy.

## Best practices
- Fix list+relation access with `select_related` (FK/O2O) or `prefetch_related` (collections) at the query origin.
- Batch lookups: collect keys, run one `filter(id__in=keys)`, then map results in memory.
- Use GraphQL dataloaders or equivalent per-request batching for resolver fan-out.
- Pin query counts with `django_assert_num_queries`, SQLAlchemy event counters, or similar guards.
- Log per-request query counts in staging under realistic fixtures and alert on growth.
- Replace per-row writes with `bulk_create`/`bulk_update` or a single set-based statement.
- Make lazy-load violations visible: disable lazy loading in tests or log every emitted query.
- Review serializer and resolver trees, not just views — most N+1s live one layer deeper.

## Quick checklist
- [ ] No loop body touches a relationship attribute per item.
- [ ] Every relation read during serialization is covered by select/prefetch or a dataloader.
- [ ] Lookups by changing keys are batched into one IN query.
- [ ] Hot endpoints have query-count assertions in tests.
- [ ] Model properties that query are marked and avoided in list contexts.
- [ ] Bulk writes use bulk operations, not per-row saves.
- [ ] Staging logs per-request query counts for realistic payloads.
- [ ] Lazy-load traps are surfaced in tests (lazy loading disabled or logged).
