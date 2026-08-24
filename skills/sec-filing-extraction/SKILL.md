---
name: sec-filing-extraction
description: Equips the advisor to verify that data extracted from SEC filings is correctly sourced, current, and faithful to the filing's audit status and hedged language.
---

# SEC Filing Extraction

Extraction work pulls financials, risk factors, and disclosures from 10-K, 10-Q, and 8-K filings into structured summaries. Accuracy requires citing the exact filing and item, respecting audit status, and preserving the qualifiers that filings deliberately include. Stale or decontextualized extractions mislead downstream analysis.

## Watch for
- Extracted figures not tied to a specific filing, item number, and location (e.g., 10-K Item 8, Note 5 to financial statements).
- Confusing filing types and audit status: 10-K annual audited, 10-Q quarterly reviewed (not audited), 8-K current-event disclosures.
- Numbers pulled from rendered HTML without checking the underlying XBRL-tagged data for discrepancies.
- Risk factors (Item 1A) summarized in ways that strip material qualifiers and forward-looking hedging.
- MD&A cherry-picking: favorable commentary extracted while known trends and uncertainties are omitted.
- Overlooked sections: off-balance-sheet arrangements, contractual obligations, critical accounting estimates.
- Amendments (10-K/A, 10-Q/A) and subsequent 8-Ks not checked, leaving stale extractions in circulation.
- Material contracts filed as exhibits (Regulation S-K Item 601) missed when extracting deal terms.

## Best practices
- Cite filing type, filing date (or accession number), item number, and page for every extracted fact.
- Prefer the financial statements and notes (Item 8) for numbers; use MD&A (Item 7) for management framing and label it as such.
- Record whether each figure is audited, reviewed, or unaudited.
- Preserve the company's own qualifiers when extracting risk factors; never convert hedged language into definitive claims.
- Check EDGAR for amendments and subsequent 8-Ks before treating any extraction as current.
- Capture critical accounting estimates with their sensitivity disclosures (Regulation S-K Item 303).
- Note the registrant's fiscal calendar; fiscal years frequently do not match calendar years.

## Quick checklist
- [ ] Filing type, date, and item cited for each fact.
- [ ] Audit/review status recorded per figure.
- [ ] Amendments and later 8-Ks checked.
- [ ] Numbers trace to financial statements and notes.
- [ ] Risk-factor hedging preserved verbatim.
- [ ] Fiscal vs calendar periods noted.
- [ ] Material exhibits identified where relevant.
