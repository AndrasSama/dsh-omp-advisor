---
name: local-llm-deployment
description: Equips the advisor to evaluate local inference server setups (llama.cpp, Ollama, vLLM) for correct sizing, flags, health checking, and service supervision.
---

# Local LLM Deployment

Reviews self-hosted inference deployments: llama.cpp/llama-server, Ollama, vLLM, or TGI. Most failures are sizing mistakes (context too large for VRAM), wrong GPU-offload flags, or missing readiness handling that makes cold starts look like outages.

## Watch for
- Context size (`-c`, `--max-model-len`) set without computing KV cache cost — OOM at load or on the first long request.
- `-ngl` / GPU layer count guessed instead of measured; partial offload with silent CPU fallback kills throughput.
- Model artifacts downloaded without checksum verification (sha256 vs the publisher's manifest).
- No readiness probe: traffic routed to the port before weights finish loading (can take minutes).
- Inference port bound to 0.0.0.0 on a public interface with no authentication.
- Concurrency/slots (`--parallel`, `--num-slots`) exceeding what VRAM supports for KV at max context.
- No restart supervision (systemd `Restart=on-failure`) and no visibility into OOM kills.
- Quantization chosen by vibe rather than by task-quality evaluation.

## Best practices
- Compute before configuring: weights ≈ params × bits/8; KV ≈ 2 × layers × kv_heads × head_dim × seq_len × bytes; leave 10–15% VRAM headroom.
- Verify artifact checksums on download; pin model + quant + version in config, never "latest".
- Gate readiness on `/health` (llama-server) or `/v1/models` (Ollama/vLLM); poll with a timeout before first use.
- Run under systemd or a container with memory limits, `Restart=on-failure`, and log rotation.
- Bind to localhost or a private interface; front with an authenticating reverse proxy for remote access.
- Start conservative on context (4k–8k) and raise only with measured VRAM headroom.
- Load-test with realistic prompt lengths; record tokens/s at target concurrency, not single-stream only.
- Keep a fallback route (smaller local model or hosted API) for primary downtime.

## Quick checklist
- [ ] VRAM math (weights + KV + headroom) documented for the chosen context
- [ ] GPU offload verified active (nvidia-smi / server logs)
- [ ] Model checksum verified and version pinned
- [ ] Readiness probe gates first traffic
- [ ] Port bound private or proxied with auth
- [ ] Process supervised with restart policy
- [ ] Concurrency fits the KV budget at max context
- [ ] Fallback route defined
