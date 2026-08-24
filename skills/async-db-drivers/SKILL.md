---
name: async-db-drivers
description: Equips the advisor to review async database access — correct asyncpg/psycopg async usage, pool sizing, and sync calls leaking into async code paths.
---

# Async DB Drivers

Async database drivers only pay off when every hop in the request path is awaited; one blocking call stalls the whole event loop and erases the concurrency benefit. Reviews should verify driver choice, pool math, and that no synchronous I/O hides inside `async def` code.

## Watch for
- Synchronous drivers (psycopg2 sync, sqlite3) or `requests` called inside `async def` handlers.
- A new connection created per query instead of using a pool.
- Pool max size set blindly (e.g. 100 per worker) exceeding the database's `max_connections`.
- Connections held across `await`s of unrelated slow I/O.
- Missing `async with` on connections/cursors, leaking connections on exceptions.
- `run_in_executor` used as a blanket wrapper instead of fixing the blocking call.
- No statement or query timeout configured on the driver or pool.
- Transactions left open when a handler raises before commit/rollback.

## Best practices
- Use a native async driver (asyncpg, psycopg async) matched to the framework's event loop.
- Size the pool as (DB max_connections / worker count) minus headroom for admin tools; verify under load.
- Acquire with `async with pool.acquire()` (or the ORM's async session) so release is exception-safe.
- Keep the checkout window minimal: don't await HTTP calls mid-transaction.
- Set statement timeouts at the pool/session level so runaway queries are killed.
- Offload genuinely blocking work with `run_in_executor` deliberately and sparingly.
- Use parameterized queries — never f-string SQL.
- Load-test the async path to confirm concurrency actually scales with pool size.

## Quick checklist
- [ ] No sync driver or sync I/O inside async handlers.
- [ ] All queries go through a bounded pool.
- [ ] Pool size is derived from DB max_connections and verified under load.
- [ ] Connection acquisition uses async context managers.
- [ ] No slow external awaits happen while holding a connection/transaction.
- [ ] Statement timeouts are configured.
- [ ] Transactions commit or roll back on every code path.
- [ ] Concurrency was load-tested, not assumed.
