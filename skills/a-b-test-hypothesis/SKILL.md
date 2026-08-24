---
name: a-b-test-hypothesis
description: Equips the advisor to evaluate A/B test designs for valid hypotheses, adequate sample sizes, and statistically sound conclusions.
---

# A/B Test Hypothesis Design

A/B testing review separates experiments from vibes: a test without a falsifiable hypothesis, a pre-declared metric, and enough traffic is just an anecdote generator.
The reviewer checks the design before launch and the interpretation after — the two most common failures are peeking early and shipping noise.

## Watch for
- No written hypothesis: "let's try red" with no expected mechanism, metric, or magnitude
- Multiple primary metrics, or moving the goalpost after seeing results
- Sample size decided by feel: tests stopped when they "look significant" (peeking inflates false positives)
- Tests run too short to cover weekly seasonality (weekday/weekend behavior differences)
- Multiple elements changed between variants so the result can't be attributed
- Ignored segment effects: an aggregate win that hides a loss for the highest-value segment
- Winners declared from one-off tests with no replication for high-stakes decisions

## Best practices
- Write the hypothesis as: "Because [insight], changing [variable] to [variant] will improve [primary metric] by [estimate] for [segment]"
- Pre-register: primary metric, guardrail metrics, minimum detectable effect, sample size, and duration — before launch
- Compute sample size from baseline conversion rate, MDE, and power (80%+, α 5%); use a calculator, not intuition
- Run full weeks (at least 1–2 business cycles) and never stop early on significance; use sequential testing if early stopping matters
- Change one variable per test, or use a designed multivariate test with enough traffic
- Check guardrails (revenue per user, bounce, support tickets) before shipping any winner
- Replicate consequential findings; treat single tests with few conversions per arm as directional only

## Quick checklist
- [ ] Hypothesis states insight, variable, metric, and expected effect
- [ ] Primary + guardrail metrics pre-declared
- [ ] Sample size computed from baseline, MDE, and power
- [ ] Test spans full weekly cycles; no early peek-stop
- [ ] One variable changed (or proper MVT design)
- [ ] Guardrail metrics checked before shipping
- [ ] High-stakes winners replicated
