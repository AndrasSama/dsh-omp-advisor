---
name: postgres-index-strategies
description: Equips the advisor to review PostgreSQL index design — correct index-type choice, partial and covering indexes, index-only scans, and index bloat control.
---

# PostgreSQL Index Strategies

Indexes are the highest-leverage database object and the easiest to get wrong: the wrong type is never used, redundant indexes slow writes, and missing indexes surface only under load. Reviews should tie every index to a concrete query and verify the planner actually uses it.

## Watch for
- Defaulting to B-tree for workloads that need GIN (jsonb/array/full-text) or GiST (range/geometry).
- Indexes on low-cardinality boolean columns the planner will never choose.
- Redundant indexes that are prefixes of, or duplicates of, other indexes.
- Queries filtering `WHERE status = 'pending'` over huge tables without a partial index.
- SELECT lists forcing heap fetches where a covering index (INCLUDE) would allow an index-only scan.
- Expression predicates in queries (`lower(email) = ...`) with no matching expression index.
- No plan for index bloat after heavy updates (no REINDEX/pg_repack story).
- Indexes added "just in case" with no query to justify them.

## Best practices
- Match index type to query: B-tree for equality/range/sort, GIN for containment/full-text, GiST for geometric/range types, BRIN for large naturally-ordered tables.
- Use partial indexes for hot subsets (e.g. `WHERE deleted_at IS NULL`) to shrink size and speed writes.
- Add `INCLUDE` columns to enable index-only scans for frequent narrow queries.
- Create expression indexes that exactly match the query predicate.
- Verify with `EXPLAIN (ANALYZE, BUFFERS)` that the index is chosen and reduces buffer reads.
- Track usage via `pg_stat_user_indexes` and drop indexes with zero scans.
- Monitor bloat and rebuild online with REINDEX CONCURRENTLY or pg_repack.
- Create new indexes CONCURRENTLY on live tables to avoid blocking writes.

## Quick checklist
- [ ] Every index is justified by at least one real query.
- [ ] Index type matches the operator class needed (B-tree/GIN/GiST/BRIN).
- [ ] Hot-subset filters use partial indexes.
- [ ] Frequent narrow reads are covered by INCLUDE for index-only scans.
- [ ] Expression predicates have matching expression indexes.
- [ ] EXPLAIN ANALYZE confirms the planner uses the index.
- [ ] Unused indexes are identified via pg_stat_user_indexes and dropped.
- [ ] Production index creation uses CONCURRENTLY and a bloat plan exists.
