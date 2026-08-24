---
name: fake-review-filtering
description: Equips the advisor to detect weak review-authenticity controls, undisclosed incentivized reviews, and astroturfing signals in user-generated review systems.
---

# Fake Review Filtering

Review systems are only as trustworthy as their authenticity controls, and regulators treat fake or undisclosed incentivized reviews as deceptive. This skill reviews how an agent-built review system collects, filters, and displays feedback. Findings are review flags; platform-specific rules should be checked against their current published policies.

## Watch for
- No verification that a reviewer actually purchased or used the item.
- Incentivized reviews (discounts, free products, payments) displayed without clear disclosure.
- Selective publication: only positive reviews shown, negatives suppressed or delayed.
- Sudden bursts of similar reviews: shared phrasing, tight time windows, brand-new accounts.
- Staff or affiliated accounts posting as ordinary customers (astroturfing).
- Reviews editable or removable by sellers without documented cause.
- Aggregate ratings computed from unfiltered or manipulated inputs.
- No process for flagging, investigating, and removing suspected fake reviews.

## Best practices
- Require purchase/usage verification where feasible, and label verified vs unverified reviews distinctly.
- Mandate prominent disclosure on any incentivized review, regardless of sentiment.
- Publish all genuine reviews, positive and negative; document moderation criteria in advance.
- Add automated heuristics (burst detection, text similarity, account-age signals) plus human review.
- Block first-party and affiliated posting, or label it unmistakably.
- Keep an audit trail: who moderated what, when, and under which rule.
- Verify aggregate scores are computed only from authentic, in-scope reviews.
- Check the platform's current published rules (marketplace, app-store policies) and flag gaps.

## Quick checklist
- [ ] Purchase/usage verification in place where feasible.
- [ ] Incentivized reviews clearly disclosed.
- [ ] Negative reviews published, not suppressed.
- [ ] Burst/similarity/new-account heuristics active.
- [ ] No unlabeled staff or affiliate reviews.
- [ ] Moderation criteria documented and auditable.
- [ ] Aggregates computed from authentic reviews only.
- [ ] Takedown process exists with an audit trail.
