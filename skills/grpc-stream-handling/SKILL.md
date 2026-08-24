---
name: grpc-stream-handling
description: Equips the advisor to evaluate flow control, cancellation propagation, deadline placement, and backpressure in gRPC streaming services.
---

# gRPC Stream Handling

Reviews bidirectional, server, and client streaming (tonic, grpc-go) where long-lived streams interact with HTTP/2 flow control. Stream bugs surface as wedged RPCs, silent message loss, or whole-connection stalls when one stream's window fills.

## Watch for
- Per-call deadlines applied to streams meant to live for hours — the RPC dies at the deadline; use per-message timeouts or keepalive instead.
- Ignoring flow control: producers writing without awaiting `SendStream::send`, buffering unboundedly in user space.
- No cancellation propagation: client disconnects but the server task keeps computing — check context cancellation between messages.
- Treating `Stream::next() == None` as an error instead of a clean half-close.
- Errors returned inside `Ok` payloads instead of proper `Status` codes, breaking client retry classification.
- Missing HTTP/2 keepalive (PING) on long-idle streams — load balancers and NATs silently kill idle TCP.
- Unbounded in-process channels between the gRPC layer and workers — the same backpressure problem moved one layer down.
- Max concurrent streams / connection limits unset, letting one client monopolize the server.

## Best practices
- Set keepalive pings on both client and server (e.g., every 30 s, timeout 10 s) for any stream crossing LBs or NAT.
- Bound in-process fan-in with bounded mpsc behind tonic; propagate backpressure to senders by awaiting.
- Map failures to meaningful `Code`s: `UNAVAILABLE` (retryable) vs `INVALID_ARGUMENT` (fatal); document which are retryable.
- In server streaming, check cancellation between sends and exit cheaply once the receiver is gone.
- Use per-message application timeouts for request/response-over-stream patterns.
- Configure `max_concurrent_streams`, initial window size, and max frame size deliberately — defaults are conservative.
- Load-test streams with realistic pacing (bursty producers, slow consumers), not just happy-path throughput.
- Log stream lifecycle events: open, half-close, cancel, error — with stream age at close.

## Quick checklist
- [ ] Long-lived streams carry no short per-call deadline
- [ ] Sends awaited / flow-controlled, not fire-and-forget
- [ ] Cancellation checked between messages
- [ ] Half-close (None) handled distinctly from errors
- [ ] Keepalive pings configured for idle streams
- [ ] Error codes distinguish retryable from fatal
- [ ] In-process channels behind streams are bounded
- [ ] Max concurrent streams set explicitly
