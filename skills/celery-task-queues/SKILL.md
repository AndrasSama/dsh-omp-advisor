---
name: celery-task-queues
description: Equips the advisor to detect unsafe Celery task design — non-idempotent work, missing retry/backoff policy, wrong ack semantics, and broker-blocking antipatterns.
---

# Celery Task Queues

Background tasks run at-least-once by default, so every task must tolerate re-execution and every failure path must be explicit. Reviews should confirm that tasks are idempotent, retries are bounded, and workers never block the broker or starve other queues.

## Watch for
- Tasks that assume exactly-once delivery (duplicate emails, double charges) with no idempotency key.
- `retry()` without `max_retries`, `countdown`/backoff, or an `autoretry_for` list.
- `acks_late=False` (the default) on long tasks where a worker crash loses in-flight work.
- Synchronous HTTP calls inside tasks with no timeout set.
- Tasks that publish more tasks in a tight loop, flooding the broker.
- Passing large payloads (full model instances, file bytes) as task arguments instead of IDs/references.
- One giant default queue mixing latency-critical and batch work.
- Calling `task.delay()` inside a DB transaction, so the task can run before the commit lands.

## Best practices
- Design every task to be safely re-runnable: idempotency keys, `update_or_create`, or conditional writes.
- Set `autoretry_for`, exponential `retry_backoff=True`, jitter, and an explicit `max_retries`.
- Route exhausted retries to a dead-letter queue via error handlers and alert on its depth.
- Use `acks_late=True` with prefetch tuning for long or critical tasks so crashes don't silently drop work.
- Pass primary keys or storage references; load fresh state inside the task.
- Set explicit timeouts on every external call and bound total task runtime.
- Separate queues by priority/latency and set per-queue worker concurrency.
- Enqueue after commit (`transaction.on_commit`) so tasks never reference uncommitted rows.

## Quick checklist
- [ ] The task is idempotent or guarded by an idempotency key.
- [ ] Retry policy has max retries, backoff, and jitter.
- [ ] Tasks that exhaust retries land in a monitored dead-letter queue.
- [ ] `acks_late` and prefetch settings match the task's crash semantics.
- [ ] All external calls have explicit timeouts.
- [ ] Task arguments are small (IDs/refs), not serialized objects.
- [ ] Enqueue happens inside `transaction.on_commit` where DB state matters.
- [ ] Queues are separated by priority with per-queue concurrency.
