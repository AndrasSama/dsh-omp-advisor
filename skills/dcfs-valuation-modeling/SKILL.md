---
name: dcfs-valuation-modeling
description: Equips the advisor to detect structural errors, unsupported assumptions, and missing sensitivity analysis in discounted cash flow valuations.
---

# DCF Valuation Modeling

Discounted cash flow analysis values a business from projected free cash flows, a discount rate, and a terminal value. It is assumption-dominant: small input changes move the output materially, so review focuses on input provenance, internal consistency, and disclosed sensitivity rather than the arithmetic alone.

## Watch for
- WACC inputs without derivation: cost of equity (CAPM — risk-free rate, beta, equity risk premium), after-tax cost of debt, and market-value capital-structure weights.
- Terminal value dominating enterprise value (e.g., >75%) without disclosure, or a Gordon growth rate exceeding long-run nominal GDP/inflation expectations.
- Free cash flow definition mismatched to the discount rate (FCFF must pair with WACC; FCFE with cost of equity).
- Projection-period growth unsupported by historical performance or stated drivers; hockey-stick ramps.
- Missing or one-dimensional sensitivity analysis on WACC and terminal growth.
- Growth without funded reinvestment: capex and working-capital builds inconsistent with revenue growth.
- Double counting: cash added to EV while FCF already earns interest on it, or unstated mid-year vs end-year discounting convention.
- No exit-multiple cross-check, or one inconsistent with the implied terminal growth rate.

## Best practices
- State the FCF definition explicitly and verify the discount rate matches it (FCFF→WACC, FCFE→cost of equity).
- Document every WACC input with source and date: 10-year government yield for the risk-free rate, a cited beta, a stated equity risk premium.
- Hold terminal growth at or below long-term nominal GDP expectations and disclose terminal value's share of EV.
- Provide at least a two-way sensitivity table (WACC × terminal growth) on implied value per share.
- Tie growth to reinvestment: growth ≈ reinvestment rate × ROIC; flag unfunded growth assumptions.
- Cross-check DCF output against trading and transaction multiples and note material divergence.
- State the discounting convention (mid-year is standard) and apply it consistently.
- Bridge EV to equity value explicitly: subtract net debt, minorities, preferred; add associates; divide by fully diluted shares.

## Quick checklist
- [ ] FCF type matches the discount rate used.
- [ ] WACC inputs are sourced and dated.
- [ ] Terminal growth ≤ long-run nominal GDP.
- [ ] Terminal value share of EV is disclosed.
- [ ] Two-way sensitivity table is present.
- [ ] Growth is tied to reinvestment assumptions.
- [ ] EV-to-equity bridge is complete and correct.
