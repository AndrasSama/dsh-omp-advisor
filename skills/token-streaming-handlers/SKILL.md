---
name: token-streaming-handlers
description: Equips the advisor to evaluate SSE/token-stream consumers for protocol parsing, backpressure, partial UTF-8, cancellation, and usage accounting correctness.
---

# Token Streaming Handlers

Reviews streaming-response handling (OpenAI-style SSE deltas, Anthropic content blocks) in clients and proxies. Streaming bugs are silent: a missed `[DONE]`, split UTF-8, or unbounded buffering shows up later as garbled text, hangs, or wrong token accounting.

## Watch for
- SSE parsers assuming one JSON object per network chunk — chunks split and coalesce; parsing must buffer on `\n\n` frame boundaries.
- Missing handling of the terminal `[DONE]` sentinel or provider stop events — the consumer hangs until timeout.
- Proxying that buffers the whole stream before forwarding — defeats streaming and inflates time-to-first-token.
- Partial multibyte UTF-8 across chunk boundaries rendered as replacement characters.
- Cancellation not propagated upstream when the consumer disconnects — the server keeps generating and burning tokens.
- Usage stats (final chunk with `usage`) dropped — billing and observability go wrong.
- No inter-chunk timeout: a stalled stream is indistinguishable from a slow one.
- Retry logic that restarts a partially consumed stream without dedup — duplicated output text.

## Best practices
- Parse SSE per the framing spec: accumulate bytes, split on blank lines, handle `data:`, `event:`, comments, and multi-line data.
- Decode UTF-8 incrementally, holding back incomplete trailing sequences.
- Forward tokens as they arrive; bound internal buffers and apply backpressure to the socket.
- Set an inter-chunk idle timeout (e.g., 30–60 s) distinct from the total request timeout.
- On consumer disconnect, cancel the upstream request immediately (abort signal / context cancel).
- Capture the final usage chunk; fall back to local token counting only when it is absent.
- Make resumption idempotent: track the delivered offset or restart cleanly from zero — never append twice.
- Normalize provider delta shapes (`choices[].delta.content` vs `content_block_delta`) behind one internal event type.

## Quick checklist
- [ ] SSE framing handles split/coalesced chunks
- [ ] [DONE]/stop events terminate cleanly
- [ ] Tokens forwarded without whole-stream buffering
- [ ] Incremental UTF-8 decode verified
- [ ] Consumer disconnect cancels upstream
- [ ] Final usage chunk captured
- [ ] Inter-chunk idle timeout set
- [ ] Restart/resume cannot duplicate output
