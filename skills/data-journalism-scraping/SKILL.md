---
name: data-journalism-scraping
description: Equips the advisor to review scraping plans and datasets for ethics, terms-of-service awareness, verification, and reproducibility.
---

# Data Journalism & Scraping

Data-driven stories are only as strong as the dataset behind them, and datasets are only as good as their provenance and validation. Scraping adds legal and ethical dimensions — terms of service, rate limits, and personal-data exposure — that must be decided deliberately, not discovered after publication. This skill reviews both the collection and the analysis.

## Watch for
- Scraping that ignores a site's terms of service or robots directives without editorial sign-off.
- Overloading a small or public-interest site with aggressive request rates.
- Collecting personal data at scale without a stated journalistic purpose.
- Datasets used without provenance: unknown origin, collection date, or method.
- No validation pass: duplicates, encoding errors, and missing values unexamined.
- Analysis that cannot be reproduced because scripts and inputs were not saved.
- Treating scraped figures as official statistics without cross-checks.
- Publishing raw data that exposes private individuals.

## Best practices
- Check terms of service, robots.txt, and rate limits before writing a scraper; document the decision.
- Throttle requests politely; cache aggressively; prefer official APIs and open data.
- Define the journalistic purpose before collecting personal data; minimize collection.
- Record dataset provenance: source, retrieval date, method, and version.
- Validate every dataset: row counts, duplicates, nulls, outliers, spot checks against source pages.
- Preserve scripts, raw inputs, and cleaning steps so any finding can be reproduced.
- Cross-check headline figures against an independent source.
- Redact or aggregate published data to protect individuals.

## Quick checklist
- [ ] ToS/robots review was documented before scraping.
- [ ] Request rates are polite and responses cached.
- [ ] Personal data collection is purpose-limited.
- [ ] Dataset provenance is fully recorded.
- [ ] A validation pass was completed and logged.
- [ ] The analysis is reproducible from saved artifacts.
- [ ] Key figures were cross-checked independently.
- [ ] Published data is redacted for privacy.
