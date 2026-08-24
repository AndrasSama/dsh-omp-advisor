---
name: redis-caching-layers
description: Equips the advisor to review Redis caching design — invalidation strategy, TTL policy, key naming, and cache stampede protection.
---

# Redis Caching Layers

A cache is a consistency and capacity decision, not just a speedup. Reviews should confirm that every cached value has an owner, an invalidation path, a TTL, and a plan for the moment the cache goes cold under load.

## Watch for
- Cache writes with no TTL ("forever" keys) and no eviction story.
- Invalidation by hope: updating the DB but never deleting/refreshing the cached copy.
- Ad-hoc key names that collide or can't be scanned/invalidated by pattern.
- Hot keys rebuilt by hundreds of concurrent requests right after expiry (stampede).
- Caching whole ORM objects or pickled models that break on schema change.
- Storing multi-MB values that bloat memory and slow the single-threaded server.
- No fallback behavior defined for a Redis outage (thundering herd to the DB).
- Cache-aside reads without a set-on-miss path, or double-writes without ordering guarantees.

## Best practices
- Give every key a TTL derived from data-staleness tolerance; make expiry explicit.
- Use a key schema (`service:entity:id:version`) so invalidation is a pattern delete or version bump.
- Prefer versioned keys or delete-on-write invalidation over in-place mutation of cached values.
- Protect stampedes: singleflight/locks on rebuild, jittered TTLs, or stale-while-revalidate.
- Cache serializable DTOs (JSON) rather than live ORM objects.
- Keep values small; shard large aggregates into per-entity entries.
- Define and test the Redis-down path: bounded DB load, circuit breaker, or degraded responses.
- Monitor hit rate, evictions, and memory; alert when the hit rate collapses.

## Quick checklist
- [ ] Every cached key has an explicit TTL.
- [ ] Key names follow a documented, namespaced schema.
- [ ] Every DB write affecting cached data invalidates or version-bumps.
- [ ] Hot-key rebuilds are stampede-protected (lock/jitter/stale-while-revalidate).
- [ ] Cached payloads are stable DTOs, not ORM instances.
- [ ] Value sizes are bounded and small.
- [ ] Redis outage behavior is defined and tested.
- [ ] Hit rate, memory, and evictions are monitored.
