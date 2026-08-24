---
name: ad-spend-roi-modeling
description: Equips the advisor to audit ad-spend models for correct ROAS/CAC math, attribution assumptions, and incrementality awareness.
---

# Ad Spend ROI Modeling

ROI modeling review checks the arithmetic and the assumptions: are ROAS and CAC computed on the right revenue window and cost basis, does the attribution model match the funnel's reality, and would the spend still look good if you removed the ads that would have converted anyway?
Bad models don't just misreport — they reallocate budget toward channels that merely take credit.

## Watch for
- ROAS computed on first purchase only for a subscription business (ignores LTV), or on gross revenue for a low-margin one (ignores COGS)
- CAC that excludes real costs: creative, tools, agency fees, and salaries counted as zero
- Last-click attribution over-crediting bottom-funnel brand/retargeting while starving prospecting
- No incrementality awareness: retargeting and brand search credited for conversions that would have happened anyway
- Payback period ignored: a "profitable" CAC that takes 18 months to recover on cash-constrained budgets
- Channels compared on incompatible windows (7-day click vs 30-day view) or different conversion definitions
- Scaling projections that assume CPA stays flat as spend increases (it never does)

## Best practices
- Define the model inputs explicitly: revenue window, margin, LTV assumptions, cost basis — and review each one
- Use contribution-margin ROAS (profit / spend), not revenue ROAS, for budget decisions
- Compute fully loaded CAC and pair it with payback period and LTV:CAC (≥3:1 is a common SaaS sanity threshold)
- Triangulate attribution: platform reports + analytics model + at least one incrementality test (holdout or geo split)
- Model diminishing returns: CPA curves up with scale; plan budgets on marginal CPA, not average
- Hold all channels to the same conversion definition and window before comparing
- Re-forecast quarterly against actuals; flag models whose predictions miss beyond the agreed tolerance

## Quick checklist
- [ ] Revenue window and margin basis explicit and appropriate
- [ ] CAC fully loaded (creative, tools, labor included)
- [ ] LTV:CAC and payback period computed, not just ROAS
- [ ] Attribution model matches funnel length; incrementality tested
- [ ] Channels compared on identical windows and definitions
- [ ] Scaling plan uses marginal, not average, CPA
- [ ] Model re-validated against actuals on a schedule
