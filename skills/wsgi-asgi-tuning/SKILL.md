---
name: wsgi-asgi-tuning
description: Equips the advisor to review WSGI/ASGI server configuration — worker model choice, worker counts, timeout tuning, and event-loop vs threading tradeoffs.
---

# WSGI/ASGI Tuning

The application server configuration decides how many requests a box can carry and how much one slow request can hurt the others. Reviews should check that the worker model matches the workload, that counts are derived from CPU and memory rather than folklore, and that timeouts fail fast instead of piling up.

## Watch for
- Default worker counts (often 1) shipped to production.
- Sync WSGI workers running blocking I/O-heavy code with too few workers to absorb latency.
- Async ASGI servers with blocking sync code in handlers, stalling the event loop per worker.
- `--timeout` left at defaults while the upstream proxy has different (shorter) timeouts.
- Threaded workers with non-thread-safe globals or shared connections.
- Max-requests/recycle unset, so memory leaks accumulate until OOM.
- Worker count set so high that total RSS exceeds host memory (swap thrash).
- Graceful timeout missing, so deploys drop in-flight requests.

## Best practices
- Choose the model by workload: sync workers for CPU-bound/legacy blocking code, async (uvicorn) for I/O-bound concurrent code.
- Start gunicorn sync workers near `2 * CPU + 1`; tune from measured saturation, not folklore.
- For ASGI, keep handlers fully async; push blocking work to a threadpool and keep worker counts modest.
- Align timeouts end to end: app server < reverse proxy < client, so the outer layer gives up first.
- Enable worker recycling (`--max-requests` with jitter) to bound leak growth.
- Budget memory: workers × per-worker RSS must fit the host with headroom.
- Configure graceful shutdown timeouts so deploys finish or abort requests cleanly.
- Load-test the chosen configuration (requests/sec, p99, error rate) before trusting it.

## Quick checklist
- [ ] Worker model matches the workload (sync vs async).
- [ ] Worker count is derived from CPU/memory and verified by load test.
- [ ] No blocking calls stall async event-loop workers.
- [ ] Timeouts are aligned across app server, proxy, and client.
- [ ] Worker recycling is enabled with jitter.
- [ ] Total worker memory fits the host with headroom.
- [ ] Graceful shutdown is configured for zero-drop deploys.
- [ ] The config was load-tested for p99 latency and error rate.
