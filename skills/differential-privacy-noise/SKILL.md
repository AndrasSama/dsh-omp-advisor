---
name: differential-privacy-noise
description: Equips the advisor to review differential-privacy implementations for honest epsilon budgets, correct mechanism choice, real privacy accounting, and disclosed utility tradeoffs.
---

# Differential Privacy & Noise Mechanisms

Differential privacy provides a quantifiable guarantee by adding calibrated noise, but the guarantee evaporates when budgets are hand-waved or accounting is skipped. This skill reviews DP implementations for mathematical honesty and practical utility. Findings are technical review flags.

## Watch for
- Epsilon chosen by vibes: no justification, no sensitivity analysis, values large enough to guarantee little.
- No privacy accounting: repeated queries composed without tracking cumulative budget.
- Mechanism mismatch: Laplace used where the query and threat model call for Gaussian, or vice versa.
- Sensitivity miscalculated for the actual query, leading to under-noising.
- Noise added once to a result that is then sliced many times, each slice leaking.
- Pre-processing that depends on private data before noise is added (leakage upstream).
- Utility impact unmeasured: stakeholders cannot see how much error the noise introduces.
- DP claims over a release while the raw dataset remains accessible elsewhere.

## Best practices
- Require an explicit epsilon (and delta, if applicable) per release, with written rationale and a total budget.
- Use a privacy accountant (composition theorems, or an RDP/moments accountant) for anything iterative.
- Match mechanism to query and threat model: Laplace for L1 sensitivity, Gaussian for L2 under (ε,δ)-DP.
- Compute sensitivity from the query definition and verify it with edge-case inputs.
- Budget every output: each published slice or refresh consumes budget; track it.
- Ensure noise is added at the point of release, after all private-data-dependent computation.
- Report utility metrics alongside privacy ones: error bounds, confidence intervals, impact on decisions.
- Confirm the guarantee's scope: DP on releases is meaningless if raw data leaks through another channel.

## Quick checklist
- [ ] Epsilon/delta stated with rationale per release.
- [ ] Cumulative budget tracked with a real accountant.
- [ ] Mechanism matches sensitivity norm and threat model.
- [ ] Sensitivity verified against the query definition.
- [ ] Every derived output consumes tracked budget.
- [ ] Noise added at release, after private computation.
- [ ] Utility error measured and disclosed.
- [ ] No parallel raw-data channel voids the guarantee.
