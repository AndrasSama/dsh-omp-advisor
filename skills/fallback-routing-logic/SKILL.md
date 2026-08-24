---
name: fallback-routing-logic
description: Equips the advisor to evaluate model/endpoint fallback routing — health checks, capability matching, budget guards, and failure-mode behavior.
---

# Fallback Routing Logic

Reviews routing layers that choose between local and hosted models, or between model tiers, under failure and budget constraints. Bad fallback logic fails open to the expensive path, routes tasks to incapable models, or creates retry storms across providers.

## Watch for
- Fallback triggered per request on every error with no circuit state — an outage hammers the backup and doubles cost.
- Capability mismatch: vision or tool-use requests routed to text-only fallbacks.
- Context length unchecked before routing: oversized prompts sent to small-context models — guaranteed failure.
- Health checks hitting `/` instead of a real readiness endpoint (weights loaded, GPU live).
- No cost guard: the cheap local path skipped because the router doesn't know per-route pricing.
- Timeout budgets not set per route (a local 7B needs more time than a hosted API for the same output).
- Fallback silently downgrades quality without telling the caller which model answered.
- Routing decisions unobservable: no per-route success/latency/cost metrics.

## Best practices
- Circuit breaker per route: open after N consecutive failures or an error-rate threshold; half-open with a single probe request.
- Match capability tags (vision, tools, JSON mode, minimum context) before a route is eligible.
- Pre-check estimated prompt tokens against the route's context limit; truncate or reject by policy.
- Health = readiness probe + recent success rate, not just an open TCP port.
- Order routes by explicit policy (cost-first, latency-first, quality-first) with per-route timeout budgets.
- Annotate responses with the route/model actually used; surface degradation to callers.
- Bound total retries across routes (e.g., primary + one fallback), then return a typed error.
- Export per-route metrics: success rate, p50/p99 latency, tokens, cost; alert on route flapping.

## Quick checklist
- [ ] Circuit breaker per route, not per-request retry
- [ ] Capability tags gate route eligibility
- [ ] Prompt size checked against route context limit
- [ ] Health checks probe real readiness
- [ ] Per-route timeout budgets set
- [ ] Actual route annotated on responses
- [ ] Total cross-route retries bounded
- [ ] Per-route success/latency/cost metriced
