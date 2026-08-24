---
name: connection-backoff-logic
description: Equips the advisor to detect missing jitter, unbounded retries, thundering-herd reconnects, and absent circuit breaking in retry and reconnect logic.
---

# Connection Backoff Logic

Reviews retry/reconnect logic for clients of flaky dependencies. Naive fixed-interval retries synchronize thousands of clients into a thundering herd exactly when an outage ends; correct backoff is exponential, jittered, capped, and budgeted.

## Watch for
- Fixed-delay retries (`sleep(1s)` in a loop) — all clients retry in lockstep after an outage.
- Exponential backoff without jitter; require full, equal, or decorrelated jitter.
- No cap on delay or total elapsed time — retries continue for hours, holding connections and memory.
- Retrying non-idempotent operations (POST payments) without idempotency keys.
- Retrying fatal errors (400, auth failures, invalid argument) as if they were transient.
- Ignoring `Retry-After` headers on 429/503 responses.
- No retry budget: a failing dependency receives 100% retry amplification from every caller at once.
- Reconnect loops re-resolving DNS and re-handshaking TLS on every attempt with no connection reuse.

## Best practices
- Exponential backoff: base 100–500 ms, ×2 per attempt, cap 30–60 s, plus jitter (±50% or decorrelated).
- Set max attempts (e.g., 5–8) and max elapsed time (e.g., 2–5 min), then surface the error to the caller.
- Classify errors explicitly in a table: retryable (timeout, 503, 429, connection reset) vs fatal (4xx except 408/429).
- Honor `Retry-After`; parse both delta-seconds and HTTP-date forms.
- Enforce a retry budget (retries ≤ ~10% of requests) or a circuit breaker (open after N consecutive failures, half-open probe).
- Attach idempotency keys to any retried mutation.
- Use vetted libraries — `backoff` / `tokio-retry` (Rust), `cenkalti/backoff` (Go) — instead of hand-rolled loops.
- Log attempt number, chosen delay, and cumulative elapsed per retry; metric retry rate per dependency.

## Quick checklist
- [ ] Delay exponential with jitter
- [ ] Delay and total elapsed capped
- [ ] Attempt count bounded
- [ ] Only retryable error classes retried
- [ ] Retry-After honored
- [ ] Idempotency keys on retried mutations
- [ ] Retry budget or circuit breaker present
- [ ] Retry attempts metriced per dependency
