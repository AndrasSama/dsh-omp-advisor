---
name: go-goroutine-patterns
description: Equips the advisor to detect goroutine leaks, missing cancellation paths, and channel misuse in Go concurrent code.
---

# Go Goroutine Patterns

Reviews goroutine lifecycle discipline in Go services. Every goroutine needs an exit path tied to context cancellation or channel closure; leaks accumulate silently and surface hours later as creeping RSS and goroutine-count alarms.

## Watch for
- `go func()` launched with no shutdown signal — no `ctx`, no done channel, no WaitGroup; leaks one goroutine per request.
- Blocking channel sends without a `select` on `ctx.Done()`; one stuck consumer wedges the producer forever.
- `context.Background()` used deep in a request path instead of deriving from the inbound request context.
- `errgroup` without `WithContext`, or `SetLimit` omitted on fan-out — unbounded goroutines over large inputs.
- Ranging over a channel whose producer can exit early without closing it — the consumer blocks forever.
- `sync.WaitGroup.Add` called inside the goroutine instead of before launch — `Wait` can return too early.
- Send-on-closed-channel panics when multiple producers share one channel without a single designated closer.
- Nil channel in a `select` branch intended to disable that case is fine; an accidental nil channel blocks forever — check intent.

## Best practices
- Rule: the starter owns the stop — every long-lived goroutine must be tied to a `context.Context` it selects on.
- Use `errgroup.WithContext` plus `SetLimit(n)` for bounded fan-out; first error cancels siblings.
- Worker pools: fixed goroutine count ranging over a shared jobs channel, drained with a WaitGroup at shutdown.
- Semaphores via buffered channels (`sem := make(chan struct{}, n)`) to cap concurrency of I/O fan-out.
- Run `go test -race` in CI and `go run -race` in smoke tests; treat race-detector reports as release blockers.
- Monitor `runtime.NumGoroutine()`; alert on monotonic growth and dump stacks via `/debug/pprof/goroutine?debug=2`.
- Use channels for ownership transfer and mutexes for state protection; never mix disciplines on the same data.

## Quick checklist
- [ ] Every `go` statement has a documented exit condition
- [ ] Blocking sends/receives sit in a `select` with cancellation
- [ ] Request context derived from, never replaced by, Background
- [ ] Fan-out bounded (errgroup limit or semaphore)
- [ ] Exactly one goroutine owns closing each channel
- [ ] WaitGroup.Add happens before the goroutine starts
- [ ] `-race` runs in CI
- [ ] Goroutine count metriced with growth alerts
