---
name: stream-pipeline-handlers
description: Equips the advisor to review Node.js stream code for backpressure bugs, error propagation gaps, and resource leaks in pipeline composition.
---

# Stream Pipeline Handlers

Streams are Node's tool for moving more data than fits in memory — but only when backpressure, errors, and cleanup are wired correctly. Reviewers check that every pipeline uses `pipeline()` (or equivalent), propagates errors to all stages, and never silently drops or buffers unboundedly.

## Watch for
- `pipe()` chains without an `error` listener on every stream in the chain.
- Manual `data`/`write` loops ignoring the `false` return (backpressure).
- `readable`/`writable` streams left open when the request aborts.
- Unbounded internal buffering (e.g. collecting chunks into one big array).
- `pipeline()` missing its callback/await, so failures go unobserved.
- Transform streams that swallow errors instead of destroying themselves.
- File descriptors or sockets leaking when a pipeline errors mid-way.
- Mixing async iteration and manual events on the same stream.

## Best practices
- Always compose with `stream.promises.pipeline`; it wires errors and cleanup.
- Respect backpressure: await `write()` returning false with `drain`, or use async iteration.
- Attach abort handling (`AbortSignal`) so cancelled requests close all stages.
- Keep transforms stateless where possible; flush state in `_flush` with error paths.
- Set `highWaterMark` deliberately for large or slow consumers instead of defaulting.
- Log which stage failed — pipeline errors should name the offending stream.
- Test with slow consumers and early aborts, not just the happy path.
- Prefer `for await...of` consumption; it handles cleanup on break/throw.

## Quick checklist
- [ ] Every pipeline built with `pipeline()` (promises) and awaited.
- [ ] Error handling covers every stage, not just the last.
- [ ] Backpressure respected on all writable paths.
- [ ] Abort/cancel closes streams and releases descriptors.
- [ ] No unbounded in-memory buffering of streamed data.
- [ ] Transforms implement `_flush` error handling.
- [ ] `highWaterMark` tuned for known payload/consumer profiles.
- [ ] Slow-consumer and early-abort cases are tested.
