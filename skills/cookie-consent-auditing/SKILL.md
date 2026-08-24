---
name: cookie-consent-auditing
description: Equips the advisor to audit cookie consent mechanisms against GDPR consent standards and ePrivacy rules, including pre-consent firing and dark patterns.
---

# Cookie Consent Auditing

Cookie consent sits at the intersection of the GDPR consent standard (Article 4(11), Article 7) and the ePrivacy Directive 2002/58/EC Article 5(3). Valid consent is freely given, specific, informed, and unambiguous — pre-ticked boxes and browse-to-consent fail it. Review verifies actual behavior (what fires before consent), not just the consent banner's configuration.

## Watch for
- Pre-ticked boxes or consent inferred from continued browsing (invalid per CJEU Planet49, C-673/17).
- No reject option, or reject harder to reach than accept (dark patterns; parity is required).
- All-or-nothing consent across cookie categories instead of granular toggles.
- Non-essential cookies firing before consent — verify via network inspection, not CMP settings alone.
- No stored consent record: who, when, what choices, which notice version.
- Withdrawal mechanism missing or harder than giving consent.
- "Legitimate interest" claimed for tracking/advertising cookies that require consent.
- Cookie notice listing stale or misclassified cookies.

## Best practices
- Require consent meeting Article 4(11)/Article 7 standards for all non-essential cookies under ePrivacy Article 5(3).
- Provide accept/reject parity: reject-all as prominent as accept-all, with granular category toggles.
- Block non-essential cookies until consent; verify with actual network-request inspection.
- Store consent receipts: identifier, timestamp, choices, notice version.
- Make withdrawal as easy as giving consent (persistent preferences control).
- Strictly necessary cookies need no consent but must be genuinely necessary; document each justification.
- Re-consent on material changes to purposes or vendors; set a re-consent cadence.
- Reconcile declared cookies against actually-set cookies periodically.

## Quick checklist
- [ ] No pre-ticked boxes or browse-to-consent.
- [ ] Reject parity and granularity present.
- [ ] No cookies fire before consent (verified).
- [ ] Consent receipts stored.
- [ ] Withdrawal as easy as consent.
- [ ] Strictly-necessary justifications documented.
- [ ] Cookie inventory reconciled.
