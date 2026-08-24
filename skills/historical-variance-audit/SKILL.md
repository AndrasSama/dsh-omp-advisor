---
name: historical-variance-audit
description: Equips the advisor to audit budget-vs-actual and period-over-period variance analyses for causal depth, basis consistency, and reconciliation integrity.
---

# Historical Variance Audit

Variance auditing checks whether differences between actuals and budgets or prior periods are computed on like-for-like bases and explained by evidence, not restated arithmetic. Shallow variance work ("revenue up because sales grew") hides the drivers that matter for forecasting. Every material variance needs a named, evidenced cause.

## Watch for
- Variance explanations that restate the numbers without causal analysis.
- Budget vs actual computed on mismatched bases (accrual vs cash, constant vs reported currency).
- YoY comparisons distorted by one-time items, acquisitions/divestitures, or accounting changes that were not adjusted for.
- Material variances left unexplained because no investigation threshold was set.
- Sign errors: favorable/unfavorable flipped between cost lines and revenue lines.
- Restatements not propagated — prior-period comparisons still using pre-restatement figures.
- Rounding artifacts creating apparent variances in small line items.
- Missing price/volume/mix decomposition for revenue and COGS variances.

## Best practices
- Decompose material variances: price × volume × mix for revenue; rate × quantity for costs.
- Define a materiality threshold explicitly and investigate everything above it.
- Normalize comparisons: constant currency, exclusion of one-timers, like-for-like scope after M&A.
- Trace each variance to a driver with evidence (transaction data, contracts, headcount changes).
- Define favorable/unfavorable sign conventions per line item and apply them consistently.
- Re-run prior periods after restatements and flag where history changed.
- Reconcile the sum of line-item variances to the total variance; no unexplained residual.
- Document assumptions and data sources for every variance explanation.

## Quick checklist
- [ ] Material variances decomposed into drivers.
- [ ] Materiality threshold stated and applied.
- [ ] Comparison bases matched (FX, scope, accounting).
- [ ] One-time items identified and adjusted.
- [ ] Sign conventions consistent across lines.
- [ ] Restatements propagated to comparisons.
- [ ] Line-item variances reconcile to the total.
