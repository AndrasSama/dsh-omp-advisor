---
name: zero-copy-parsing
description: Equips the advisor to evaluate allocation hot paths and verify that borrowed/zero-copy parsing is applied where it pays and not where it costs.
---

# Zero-Copy Parsing

Reviews hot-path deserialization where per-message allocations dominate CPU: borrowed parsers, `Bytes`-based slicing, and SIMD-assisted JSON. Zero-copy is a tool for measured allocation hot spots, not a universal virtue — lifetime complexity has a real maintenance cost.

## Watch for
- `String`/`Vec<u8>` fields in hot-path structs where `&str`/`&[u8]` or `bytes::Bytes` would do (serde: `#[serde(borrow)]`).
- Repeated `to_vec()` / `to_string()` on slices that are only inspected, never stored.
- Parsing whole messages into a DOM when a streaming/pull parser or field-skipping would suffice.
- `Bytes` split into many tiny subslices each kept alive — reference-count churn; batch instead.
- Zero-copy applied to cold config parsing, adding lifetime gymnastics for zero measurable gain.
- Intermediate copies through the codec stack: read → Vec → slice → parse, when `read_buf`/`BytesMut` could feed the parser directly.
- simd-json adopted without benchmarking against serde_json on the real payload mix.
- Buffer reuse without clear discipline (`BytesMut::clear` vs `truncate`) causing stale-data bugs.

## Best practices
- Profile first: an allocation flamegraph (heaptrack/jemalloc) must show parsing allocations as a hot spot before restructuring.
- serde with `#[serde(borrow)]` and `&'a str` fields for zero-copy JSON; `Bytes` when data must outlive the parse frame.
- Use `BytesMut` as the socket read target and `split_to` views into it — one allocation per datagram.
- For JSON-heavy paths, evaluate `simd-json` or `sonic-rs` against your payload distribution; pin and verify versions.
- Keep the zero-copy boundary narrow: borrow inside the parser, convert to owned once at the storage boundary.
- Preallocate with capacity hints (`Vec::with_capacity`, `BytesMut::reserve`) when sizes are knowable.
- Reuse buffers across messages in per-connection state, with the clear/reset discipline documented.
- Benchmark end-to-end (msg/s and p99), not parser microbenchmarks alone.

## Quick checklist
- [ ] Allocation profile justifies the zero-copy work
- [ ] Hot-path structs borrow or use Bytes, not String/Vec
- [ ] No intermediate full-buffer copies in the codec chain
- [ ] serde(borrow) used for borrowed deserialization
- [ ] Buffer reuse has explicit clear/reset discipline
- [ ] SIMD parser choice backed by benchmark on real payloads
- [ ] Owned conversion happens once at the storage boundary
- [ ] End-to-end throughput and p99 measured
