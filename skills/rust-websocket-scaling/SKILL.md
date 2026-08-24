---
name: rust-websocket-scaling
description: Equips the advisor to evaluate Rust WebSocket services for per-connection memory budgets, backpressure policy, and fan-out patterns that determine horizontal scalability.
---

# Rust WebSocket Scaling

Covers Rust WebSocket server design (axum, tokio-tungstenite) under tens of thousands of concurrent connections. At scale, failures come from allocation and backpressure — unbounded outbound queues, global-lock registries, O(n²) broadcasts — not from protocol bugs.

## Watch for
- `mpsc::unbounded_channel` as the per-connection send queue: one slow client grows RSS without bound; require a bounded channel with an explicit drop-oldest or disconnect-on-full policy.
- Connection registry behind a single `Mutex<HashMap>`; every fan-out serializes on that lock — flag it and suggest `DashMap` or sharded registries.
- Missing `max_message_size` / `max_frame_size` in `WebSocketConfig` — one hostile frame can force a multi-gigabyte allocation.
- No ping/pong watchdog: half-open TCP peers keep their slot for minutes after the client dies.
- Broadcast implemented by looping over all sockets per message (O(n²) wakeups) instead of `tokio::sync::broadcast` or external pub/sub.
- Heavy work (large JSON serialization, compression, DB calls) inline in the socket task instead of `spawn_blocking` or pre-serialized buffers.
- `split()` sink/stream halves moved into separate tasks with no cancellation path, leaking one half when the other exits.
- Shutdown that drops the listener without sending close frames (1001) or draining in-flight sends.

## Best practices
- Budget per-connection memory (socket buffers + channel capacity + task overhead); 100k connections × 32 KB is already ~3 GB.
- Set `WebSocketConfig { max_message_size, max_frame_size, max_send_queue, max_write_buffer_size }` explicitly; never rely on defaults.
- Fan out with a bounded `broadcast` channel; treat `RecvError::Lagged` as "slow consumer — skip or disconnect", never block the producer.
- Per-connection watchdog: Ping every 30 s, close if Pong is missing after 10 s.
- Set `TCP_NODELAY` for small, latency-sensitive frames; leave Nagle on for bulk telemetry.
- Beyond one node, move fan-out to Redis/NATS pub/sub and keep connection state route-agnostic.
- Export gauges: open connections, per-connection channel depth, lagged-receiver count, close-code histogram.
- Conformance-test with Autobahn|Testsuite; capacity-test with scripted tokio clients, not just `wrk`.

## Quick checklist
- [ ] All per-connection channels bounded with a documented full-queue policy
- [ ] Message/frame size caps set explicitly
- [ ] Ping/pong watchdog closes dead peers
- [ ] Registry sharded or lock-free, not one global Mutex
- [ ] Fan-out is O(n) per message
- [ ] Slow consumers detected (lag) and shed
- [ ] Graceful shutdown sends close frames with a deadline
- [ ] Connection-count and queue-depth metrics exist
