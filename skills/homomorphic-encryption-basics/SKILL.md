---
name: homomorphic-encryption-basics
description: Equips the advisor to assess whether homomorphic encryption genuinely fits a use case, to sanity-check scheme selection, and to call out HE when it is overkill or unrealistic.
---

# Homomorphic Encryption Basics

Homomorphic encryption lets a server compute on encrypted data without decrypting it — a powerful property with severe performance costs that make fit assessment the core review skill. This skill helps the advisor distinguish legitimate HE use cases from architecture theater. Findings are technical review flags.

## Watch for
- HE proposed where trusted execution, secure multiparty computation, or simple aggregation would suffice at a fraction of the cost.
- No benchmark or cost model: ciphertext expansion and compute overhead unquantified.
- Scheme mismatch: fully homomorphic chosen when the workload is additions-only (a partial scheme would do).
- Circuit depth ignored: bootstrapping costs and noise budgets unanalyzed.
- HE applied to interactive or low-latency paths where its overhead conflicts with SLOs.
- Input/output trust gaps unaddressed: HE protects computation, not data at entry/exit or result interpretation.
- Key management hand-waved: who holds keys, who decrypts results, where.
- Vendor claims accepted without independent verification of scheme parameters and security levels.

## Best practices
- Start from the threat model: what must the computing party NOT learn, and is HE the only way to prevent it?
- Classify the workload's operations: additions only (partially homomorphic), limited depth (somewhat/leveled), or arbitrary (fully homomorphic) — pick the weakest scheme that suffices.
- Demand numbers: ciphertext size expansion, operation latency, and end-to-end throughput versus the baseline.
- Keep HE out of latency-critical paths unless benchmarks prove feasibility.
- Review the full pipeline: encryption at input, computation, decryption at output — including who holds keys.
- Verify parameter sets against published security estimates rather than vendor marketing.
- Consider alternatives explicitly: TEEs, MPC, differential privacy, or trusted aggregation may fit better.
- Pilot on a representative slice of the real workload before committing.

## Quick checklist
- [ ] Threat model justifies HE over simpler alternatives.
- [ ] Weakest sufficient scheme class selected.
- [ ] Ciphertext expansion and latency benchmarked.
- [ ] Circuit depth / noise budget analyzed.
- [ ] Latency SLO compatibility verified.
- [ ] Input/output trust boundaries addressed.
- [ ] Key management specified end to end.
- [ ] Parameters checked against published security estimates.
