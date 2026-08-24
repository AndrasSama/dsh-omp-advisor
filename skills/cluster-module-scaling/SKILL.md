---
name: cluster-module-scaling
description: Equips the advisor to review Node.js cluster setups for worker lifecycle bugs, uneven load, and unsafe shared-state assumptions across processes.
---

# Cluster Module Scaling

`node:cluster` multiplies throughput by forking one worker per core — but workers are separate processes with separate memory, and the master must keep them alive and balanced. Reviewers check restart semantics, message-passing costs, and whether cluster is even the right tool versus worker threads or a process manager.

## Watch for
- Workers exiting without the master respawning them (silent capacity loss).
- Shared in-memory state (caches, sessions) assumed consistent across workers.
- Sticky-session requirements ignored when load balancing websockets.
- `cluster` used where a process manager (pm2/systemd) already handles forking.
- Graceful shutdown missing: workers killed mid-request on deploy.
- IPC message floods between master and workers on hot paths.
- Uneven worker load from OS-level accept-balancing quirks.
- File handles or server handles not released by dying workers.

## Best practices
- Always respawn on `exit` unless the exit was a planned shutdown.
- Treat per-worker memory as private: externalize sessions/caches to Redis or similar.
- Implement graceful shutdown: stop accepting, drain in-flight, then exit.
- Use `server` handle passing (default round-robin) deliberately; document the choice.
- For websockets/long connections, add sticky sessions at the balancer.
- Keep IPC payloads small and infrequent; never per-request.
- Roll restarts (one worker at a time) for zero-downtime deploys.
- Compare against worker_threads first when the bottleneck is CPU, not accept load.

## Quick checklist
- [ ] Worker exit always triggers respawn or planned-shutdown logic.
- [ ] No state assumed shared across worker processes.
- [ ] Graceful drain implemented before worker exit.
- [ ] Balancing strategy (round-robin vs handle) documented.
- [ ] Long-lived connections handled with sticky routing.
- [ ] IPC traffic bounded and not on the request path.
- [ ] Deploys roll workers one at a time.
- [ ] Cluster justified over threads or an external process manager.
