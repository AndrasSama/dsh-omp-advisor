---
name: reverse-proxy-configs
description: Equips the advisor to evaluate reverse proxy configurations (nginx/Caddy/Traefik) for header hygiene, WebSocket/streaming support, timeouts, and path-rewrite bugs.
---

# Reverse Proxy Configs

Reviews reverse proxy rules terminating TLS and routing to backends. Proxy misconfiguration is both a reliability bug (broken WebSockets, truncated streams) and a security hole (header spoofing, open proxies, path traversal to admin endpoints).

## Watch for
- Missing WebSocket upgrade: no `Upgrade`/`Connection` forwarding (nginx needs `proxy_http_version 1.1` plus the upgrade map) — WS handshakes fail.
- `X-Forwarded-For`/`X-Real-IP` appended without sanitizing client-supplied values — spoofable trust chain.
- Backends trusting `X-Forwarded-*` from any source, not only the proxy's addresses.
- Default 60 s `proxy_read_timeout` killing SSE/streaming/long-poll endpoints.
- Buffering left on for streaming responses (nginx `proxy_buffering` default) — SSE stalls.
- Trailing-slash path-rewrite bugs: `location /api/` with vs without a URI on `proxy_pass` — doubled or missing prefixes.
- Open proxy: `proxy_pass` built from client-controlled Host/URL variables.
- No upstream health handling — traffic keeps flowing to dead backends without checks or retries.

## Best practices
- Forward identity headers explicitly and overwrite (not append) at the trusted edge; backends accept them only from proxy IPs.
- Enable WebSockets: `proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"` (Caddy/Traefik do this by default).
- Set timeouts per route: short for APIs, long for SSE/WS with idle-timeout semantics.
- Disable buffering on streaming routes; honor `X-Accel-Buffering: no` where the app controls it.
- Normalize paths with explicit rewrite rules; test `/api` and `/api/` plus encoded traversal (`%2e%2e`).
- Add active or passive health checks and connection draining on deploys.
- Terminate TLS with modern settings (TLS 1.2+, strong ciphers, HSTS) and redirect HTTP→HTTPS.
- Log upstream response time and status; alert on 502/504 spikes.

## Quick checklist
- [ ] WebSocket upgrade headers configured and tested
- [ ] Forwarded headers overwritten at edge, trusted only from proxy
- [ ] Per-route timeouts fit the endpoint type
- [ ] Buffering off for streaming routes
- [ ] Path rewrites tested including traversal attempts
- [ ] Health checks plus drain on deploy
- [ ] TLS termination modern, HTTP redirected
- [ ] Upstream error rates alerted
