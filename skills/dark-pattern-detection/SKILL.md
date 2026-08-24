---
name: dark-pattern-detection
description: Equips the advisor to identify manipulative interface patterns — confirmshaming, hidden costs, roach motels, forced continuity, and false urgency — that regulators treat as deceptive or unfair.
---

# Dark Pattern Detection

Dark patterns are interface choices that steer users into decisions against their own interests, and both the FTC and EU regulators (including via the DSA's provisions on interface design) treat many of them as actionable deception or unfairness. This skill gives the advisor a taxonomy for spotting them in flows an agent built. Findings are review flags, not legal conclusions.

## Watch for
- Confirmshaming: decline options worded to guilt the user ("No thanks, I don't like saving money").
- Hidden costs: fees or charges that surface only at the final step.
- Roach motels: trivially easy entry, deliberately hard exit (subscriptions, accounts, consents).
- Forced continuity: free trials silently converting to paid without clear reminder and consent.
- Countdown timers and scarcity claims that are false, reset, or untethered to real deadlines.
- Misdirection: visual emphasis on the business-favored option, disguised ads, pre-ticked consents.
- Nagging: repeated interruptions designed to wear down refusal.
- Sneak-into-basket: items added to the cart without an explicit user action.

## Best practices
- Walk every consent, signup, purchase, and cancellation flow as a skeptical user and screenshot each step.
- Apply the symmetry test: is leaving as easy as joining, and declining as easy as accepting?
- Verify every urgency or scarcity claim against real backend data (actual stock, actual deadline).
- Require neutral wording on both accept and decline options.
- Check that nothing is added to a cart or bill without an explicit user action.
- Review default states: defaults should favor the user's likely intent, not a business metric.
- Use the FTC dark-patterns taxonomy and DSA Article 25's design-related prohibitions as awareness references.
- Escalate patterns that combine with payments or personal data as high severity.

## Quick checklist
- [ ] Decline options worded neutrally, no guilt copy.
- [ ] All costs visible before final commitment.
- [ ] Cancellation/exit path as easy as entry.
- [ ] Trial conversion requires clear reminder and consent.
- [ ] Urgency/scarcity claims verified against real data.
- [ ] No pre-ticked boxes or sneak additions.
- [ ] Defaults favor user intent over business metrics.
- [ ] High-severity patterns touching payments/data escalated.
