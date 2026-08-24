---
name: kv-cache-optimization
description: Equips the advisor to evaluate KV cache configuration — paging, prefix caching, quantization, and eviction — for throughput and memory efficiency.
---

# KV Cache Optimization

Reviews how an inference server manages the key-value cache, the dominant variable cost of serving long contexts. Correct setup turns repeated prefixes into cache hits and fits more concurrent sequences per GPU; wrong setup fragments memory and silently halves throughput.

## Watch for
- PagedAttention block size left at default without testing against the workload's length distribution.
- Prefix/prompt caching enabled while prompt prefixes are volatile (timestamps early in the prompt) — hit rate near zero.
- KV cache quantization (FP8/INT8) applied without a quality eval on the actual task.
- No cache observability: hit rate, eviction count, and prefix depth invisible.
- Eviction policy mismatch: LRU evicting hot system-prompt prefixes while one-off long contexts stay resident.
- Sliding-window assumptions applied to models that don't use sliding-window attention.
- `max_num_seqs` set without checking the KV budget per sequence — preemption storms under load.
- Speculative decoding enabled with a draft model whose KV layout mismatches the target.

## Best practices
- Use paged KV (vLLM/SGLang) over contiguous allocation; tune block size (commonly 16–32 tokens) with your length distribution.
- Structure prompts for prefix reuse: static system + tools first, volatile user content last; measure hit rate.
- Enable FP8 KV where hardware supports it and evals show no quality regression — roughly halves KV memory.
- Export and alert on cache metrics: hit rate, evictions, GPU KV utilization, preempted requests.
- Pin hot prefixes (system prompts) where the engine supports priority retention.
- Compute KV per sequence at max context; set max concurrency = budget / per-sequence KV, then load-test.
- For GQA/MQA models, account for reduced KV heads in the math (kv_heads < query heads).
- Re-validate cache config after model swaps — layer count and head geometry change the arithmetic.

## Quick checklist
- [ ] Paged KV enabled with workload-tuned block size
- [ ] Prompt structure keeps prefixes cache-stable
- [ ] Cache hit rate measured and non-trivial
- [ ] KV quantization quality-eval'd before enabling
- [ ] Eviction/priority policy matches traffic mix
- [ ] Max concurrency derived from the KV budget
- [ ] Evictions and preemptions alerted
- [ ] Config re-validated on model change
