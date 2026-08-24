---
name: vram-allocation-strategy
description: Equips the advisor to verify VRAM budgets — weights, KV cache, and headroom — and detect OOM-prone inference configurations.
---

# VRAM Allocation Strategy

Reviews GPU memory planning for inference: weight footprint from quantization, KV cache growth with context and batch, and the headroom CUDA itself needs. Reviewers should demand the arithmetic, not the vibe — OOMs are almost always predictable in hindsight.

## Watch for
- Weight estimates using the wrong bits-per-weight for the quant (Q4_K_M ≈ 4.85 bits/weight, not 4.0; FP16 = 2 bytes).
- KV cache ignored entirely: for a 70B-class model at 8k context, KV is ~2 GB per sequence in FP16 — multiplied by concurrency it rivals the weight footprint.
- `--gpu-memory-utilization` (vLLM) set to 0.95+ on shared GPUs — allocator fragmentation OOMs.
- Batch size raised without recomputing per-request KV × concurrency.
- Partial offload (`--n-gpu-layers` too low) producing a few tokens/sec while appearing "working".
- Multiple models resident concurrently with no eviction policy (Ollama `keep_alive` stacking).
- No monitoring: OOM discovered via user-visible failure instead of nvidia-smi/DCGM alerts.
- Compute-capability mismatch unchecked (older cards lack FP8) before choosing a quant.

## Best practices
- Weight VRAM ≈ params × bits_per_weight / 8 plus ~5–10% overhead; KV per token ≈ 2 × layers × kv_heads × head_dim × bytes.
- Reserve 10–15% of card VRAM as headroom; 20%+ on shared cards.
- Size KV for (max_context × max_concurrent_requests), not for a single stream.
- Verify actual GPU layer placement at startup (server log / nvidia-smi process list); assert an expected tokens/s floor.
- Set explicit unload/eviction policy on multi-model hosts (`OLLAMA_KEEP_ALIVE`; one model per GPU for vLLM).
- Alert at an 85% VRAM watermark; log peak allocation per request class.
- Match quant to hardware: FP8 needs Hopper/Ada+; AWQ/GPTQ INT4 serves well on Ampere.
- Re-run the math whenever context length, batch, or model changes — treat it as a config-review gate.

## Quick checklist
- [ ] Weight footprint computed with correct bits-per-weight
- [ ] KV computed for max context × concurrency
- [ ] 10–15% headroom reserved (more if shared)
- [ ] GPU offload verified in runtime logs
- [ ] Multi-model eviction policy configured
- [ ] VRAM watermark alert at ~85%
- [ ] Quant compatible with GPU compute capability
- [ ] Math re-checked on any context/batch change
