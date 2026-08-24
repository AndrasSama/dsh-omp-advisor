---
name: load-balancer-strategies
description: Equips the advisor to evaluate load balancer choices — algorithm fit, health check design, persistence, connection draining, and LB high availability.
---

# Load Balancer Strategies

Reviews L4/L7 load balancing design: algorithm selection, health checks, session handling, and the LB's own availability. Bad LB design amplifies outages — poor health checks take down healthy backends, and wrong algorithms create hot spots.

## Watch for
- `ip_hash` persistence behind CGNAT or carrier proxies — thousands of users share one "IP" and overload one backend.
- Health checks hitting a cheap endpoint (`/ping`) that returns 200 while the app's real dependencies (DB, queue) are broken.
- Active health check interval × timeout so slow that dead backends receive traffic for 30+ seconds.
- No connection draining: deploys hard-close long-lived connections (WS, gRPC streams) causing client errors.
- Session persistence used as a substitute for stateless design — stickiness breaks on backend death anyway.
- A single LB instance with no failover (no keepalived/VRRP pair or managed LB) — the LB is the SPOF.
- least_conn configured while long-lived idle connections skew the counts.
- TLS terminated per request without session resumption — handshake CPU dominates.

## Best practices
- Choose the algorithm by traffic: round-robin for uniform-cost requests, least_conn for variable cost, consistent hashing only when cache locality matters.
- Deep health checks: exercise the path that matters (auth + one real query) with tight timing (e.g., 2 s interval, 1 s timeout, 3 strikes).
- Enable connection draining with a deadline on backend removal; send GOAWAY/close frames gracefully for HTTP/2 and WebSockets.
- Prefer stateless backends + shared session store over stickiness; if sticky, use cookie-based L7 persistence, not ip_hash.
- Make the LB itself highly available: keepalived/VRRP pair or a managed LB; test failover.
- Enable TLS session resumption and keepalive reuse to backends.
- Slow-start new or recovered backends (weight ramp) to avoid thundering herds.
- Export per-backend latency/error/connection metrics; alert on backend flapping.

## Quick checklist
- [ ] Algorithm matches traffic cost profile
- [ ] Health checks exercise real dependencies
- [ ] Dead-backend detection within seconds
- [ ] Connection draining configured and tested
- [ ] Persistence strategy survives backend death
- [ ] LB itself highly available
- [ ] TLS resumption and keepalives enabled
- [ ] Per-backend metrics and flap alerts
