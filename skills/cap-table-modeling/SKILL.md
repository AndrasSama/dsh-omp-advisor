---
name: cap-table-modeling
description: Equips the advisor to detect dilution, conversion, and waterfall errors in capitalization table models across financing rounds.
---

# Cap Table Modeling

Cap table modeling tracks ownership across rounds, converting SAFEs, notes, and options into fully diluted share counts and liquidation waterfalls. Errors hide in instrument mechanics and rounding: ownership must sum to exactly 100% fully diluted, and every share count must trace to a document. Review round-by-round, not just the endpoint.

## Watch for
- Fully diluted counts omitting options, warrants, SAFEs, convertible notes, or the unallocated option pool.
- SAFE/convertible-note conversions modeled without correct valuation-cap vs discount mechanics (cap typically applies at the next priced round).
- Liquidation preferences absent from waterfall scenarios (participating vs non-participating, preference multiples).
- Option pool shuffle ignored: a pre-money pool dilutes existing holders differently from a post-money pool.
- Pro-rata rights and their exercise assumptions unstated in round modeling.
- Anti-dilution provisions (broad-based weighted average vs full ratchet) ignored in down-round scenarios.
- Rounding errors: ownership percentages not summing to 100% across the table.
- Missing distinction among authorized, issued, outstanding, and reserved shares.

## Best practices
- Build round-by-round: each financing as its own step with pre/post-money valuation, price per share, and instrument conversions.
- Track every instrument's terms: valuation cap, discount, interest rate, maturity, MFN clause for SAFEs/notes.
- Model liquidation waterfalls with preference order, participation, and conversion elections at multiple exit values.
- Verify fully diluted count = common + preferred-as-converted + options (vested and unvested) + warrants + converted SAFEs/notes; ownership sums to 100%.
- State option pool size as a percentage of post-money and note whether it was created pre- or post-money.
- Run down-round scenarios to surface anti-dilution adjustments and their dilution effects.
- Keep a source column for every share count (board resolutions, financing documents).
- Note 409A valuation/strike-price context when option value claims appear.

## Quick checklist
- [ ] All instruments enumerated and converted.
- [ ] Ownership sums to 100% fully diluted.
- [ ] Liquidation preferences modeled in the waterfall.
- [ ] SAFE cap/discount mechanics correct.
- [ ] Option pool pre/post-money treatment stated.
- [ ] Anti-dilution tested in a down-round scenario.
- [ ] Share counts sourced to documents.
