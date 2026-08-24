---
name: model-quantization-rules
description: Equips the advisor to evaluate quantization choices (GGUF/GPTQ/AWQ levels) against model size, hardware capability, and acceptable quality loss.
---

# Model Quantization Rules

Reviews quantization format and level selection for a given model and target hardware. Quantization is a quality/memory trade-off with measurable cliffs: too aggressive on small models destroys capability, too conservative wastes VRAM.

## Watch for
- Sub-Q4 quants on models ≤ 7B — small models lack the redundancy to absorb 2–3-bit quantization; quality collapses.
- Legacy round-to-nearest quants (q4_0/q4_1) chosen when K-quants (Q4_K_M) are available at similar size with better quality.
- GPTQ/AWQ run with too few or off-domain calibration samples (generic text for a code model).
- Quantization applied blindly to embedding/reranker models without retrieval-quality eval — they degrade differently from chat models.
- Comparing quants by file size alone, ignoring bits-per-weight and runtime speed differences.
- No perplexity or task eval before/after — shipping a quant blind.
- Quant format incompatible with the serving runtime (GGUF artifact aimed at a GPTQ-only server).
- Assuming quantized models behave identically at long context — some quants degrade earlier as context grows.

## Best practices
- Default serving quants: Q4_K_M (GGUF) or 4-bit AWQ/GPTQ on GPU; Q5_K_M/Q6_K when VRAM allows and quality matters; Q8_0 as a near-lossless baseline.
- Keep ≥ Q5 for models ≤ 7B; reserve Q2/Q3 for large models (≥ 30B) where size forces the trade.
- Calibrate GPTQ/AWQ with 256–1024 samples drawn from the real task distribution.
- Gate adoption on evals: perplexity delta plus a small task suite (20–50 representative prompts).
- Match format to runtime: GGUF → llama.cpp/Ollama; GPTQ/AWQ → vLLM/TGI; FP8 → Hopper/Ada.
- Record bits-per-weight and measured tokens/s per candidate; decide from the table, not the filename.
- Pin exact quant + runtime versions; re-eval when runtime upgrades change kernels.
- Include a long-context probe in the eval gate for long-context workloads.

## Quick checklist
- [ ] Quant level appropriate for model size (≥ Q5 under 7B)
- [ ] Modern K-quant formats preferred over legacy
- [ ] Calibration data sufficient and on-domain
- [ ] Perplexity/task eval run before adoption
- [ ] Format compatible with the serving runtime
- [ ] Embedding models eval'd separately
- [ ] bits-per-weight + tokens/s recorded per candidate
- [ ] Long-context probe included where relevant
