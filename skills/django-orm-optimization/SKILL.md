---
name: django-orm-optimization
description: Equips the advisor to detect inefficient Django QuerySet usage — lazy-evaluation misuse, missing select_related/prefetch_related, and accidental queries in loops.
---

# Django ORM Optimization

Django's ORM hides SQL behind QuerySets, and that hiding makes it easy to issue hundreds of unintended queries per request. A reviewer must verify that querysets stay lazy until needed, that joins and prefetches are declared explicitly, and that iteration never triggers per-row database access.

## Watch for
- Accessing a queryset inside a template or serializer loop, triggering lazy evaluation row by row.
- Iterating a parent queryset and then touching a ForeignKey or M2M attribute per row (classic N+1).
- Missing `select_related()` on ForeignKey/OneToOne relations that are read in the same pass.
- Missing `prefetch_related()` on reverse-FK or M2M traversals.
- Using `only()`/`defer()` while still reading deferred fields later, causing an extra query per row.
- Calling `len(queryset)` or `bool(queryset)` where `.count()` or `.exists()` would suffice.
- Re-evaluating the same queryset multiple times instead of materializing it once.
- Slicing a queryset and then filtering further in Python instead of in the ORM.

## Best practices
- Add `select_related` for every FK/O2O accessed in the same pass; add `prefetch_related` (with `Prefetch` objects when filtering) for collections.
- Use `.count()` / `.exists()` for cardinality and membership checks, never `len()`.
- Materialize once with `list(qs)` when the result is iterated more than once.
- Project only needed columns with `values()` / `values_list()` for read-only reporting paths.
- Push filtering, ordering, and aggregation into the ORM (`filter`, `annotate`, `aggregate`) instead of Python.
- Verify behavior with django-debug-toolbar, `connection.queries`, or pytest-django's `django_assert_num_queries`.
- Use `iterator(chunk_size=...)` for very large result sets to avoid loading all objects into memory.
- Keep queryset construction in model managers so optimizations are centralized and testable.

## Quick checklist
- [ ] No queryset is iterated inside the iteration of another queryset.
- [ ] Every FK/O2O touched during serialization is covered by `select_related`.
- [ ] Every reverse/M2M relation touched is covered by `prefetch_related`.
- [ ] `.count()`/`.exists()` are used instead of `len()`/`bool()` on querysets.
- [ ] Fields named in `only()`/`defer()` are never read downstream.
- [ ] Hot list endpoints have query-count assertions in tests.
- [ ] Large exports use `iterator()` with an explicit chunk size.
- [ ] Queryset logic lives in managers, not scattered across views.
