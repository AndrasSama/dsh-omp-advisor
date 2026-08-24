---
name: worker-threads-delegation
description: Equips the advisor to review CPU-bound work offloaded to Node worker threads for message-passing overhead, lifecycle bugs, and pool misuse.
---

# Worker Threads Delegation

`node:worker_threads` moves CPU-bound work off the event loop — at the price of message passing, separate memory, and explicit lifecycle management. Reviewers check that the work is actually CPU-bound, payloads cross the boundary cheaply, and workers are pooled and terminated cleanly.

## Watch for
- Worker spawned per task with no pooling (startup cost dominates).
- Large objects structured-cloned per message where transferable buffers would do.
- Workers never terminated on shutdown, blocking clean process exit.
- SharedArrayBuffer used without understanding Atomics requirements.
- CPU work sent to workers that is smaller than the messaging overhead.
- No error handling for worker `error` events or `exitCode != 0`.
- Worker files resolved by relative paths that break under bundlers.
- Tasks queued without backpressure when all workers are busy.

## Best practices
- Pool workers (one per core is a sane default) and reuse across tasks.
- Use `transferList` for ArrayBuffers; avoid cloning large payloads.
- Profile first: only delegate work that measurably stalls the event loop.
- Handle worker `error` and non-zero `exit`; requeue or fail the task.
- Terminate pools on shutdown with a drain timeout, then `worker.terminate()`.
- Keep the worker API task-shaped (one request → one response), not chatty.
- Resolve worker scripts with absolute paths (`new URL('./w.js', import.meta.url)`).
- Bound the task queue and reject/queue-overflow deliberately under load.

## Quick checklist
- [ ] Delegated work is verified CPU-bound and worth the IPC cost.
- [ ] Workers pooled and reused, not spawned per task.
- [ ] Large payloads use transferables, not structured clone.
- [ ] Worker error and non-zero exit handled per task.
- [ ] Pool drains and terminates cleanly on shutdown.
- [ ] Worker script paths bundler-safe (absolute resolution).
- [ ] Task queue has bounded backpressure.
- [ ] Shared memory (if any) guarded by Atomics.
