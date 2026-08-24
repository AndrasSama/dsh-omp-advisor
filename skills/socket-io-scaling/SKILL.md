---
name: socket-io-scaling
description: Equips the advisor to review Socket.IO deployments for multi-node broadcast bugs, missing sticky sessions, adapter misconfiguration, and reconnect storms.
---

# Socket.IO Scaling

A single Socket.IO node is easy; several behind a load balancer is where it breaks: in-memory rooms stop spanning nodes, websockets need sticky routing, and reconnecting clients can stampede the cluster. Reviewers check the adapter, the balancer, and the reconnect policy together.

## Watch for
- Multi-node deploys with no Redis adapter — events only reach local sockets.
- Load balancer without sticky sessions breaking websocket upgrades.
- Broadcasts to huge rooms fanned out synchronously in a request handler.
- Reconnect config with no backoff/jitter — clients hammer the cluster on outage.
- `volatile`/`broadcast` misuse dropping or duplicating critical events.
- No heartbeat tuning: half-open connections piling up behind NAT/LBs.
- Auth checked only on connect, never re-validated for long-lived sockets.
- Memory growing per socket (per-connection listeners, unbounded buffers).

## Best practices
- Use `@socket.io/redis-adapter` (or equivalent) for any multi-node deployment.
- Enable sticky sessions at the balancer (ip-hash or cookie-based affinity).
- Emit with `to(room)` and let the adapter shard; avoid manual per-socket loops.
- Configure client reconnect with exponential backoff plus jitter, capped retries.
- Tune `pingInterval`/`pingTimeout` to your LB's idle timeout, and test NAT expiry.
- Re-authenticate on reconnect; treat long-lived sockets as sessions that expire.
- Load-test reconnect storms: kill a node and watch the others absorb the wave.
- Track per-node connection counts so imbalance is visible, not invisible.

## Quick checklist
- [ ] Redis (or equivalent) adapter configured for multi-node.
- [ ] Sticky sessions enabled and upgrade path tested.
- [ ] Room broadcasts go through the adapter, not manual loops.
- [ ] Reconnect uses backoff + jitter with capped retries.
- [ ] Heartbeat intervals aligned with LB idle timeouts.
- [ ] Auth re-checked on reconnect for long-lived sockets.
- [ ] Reconnect-storm behavior load-tested.
- [ ] Per-node connection balance monitored.
