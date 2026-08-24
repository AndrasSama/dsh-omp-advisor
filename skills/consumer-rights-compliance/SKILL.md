---
name: consumer-rights-compliance
description: Equips the advisor to detect missing pre-contract information, weakened statutory guarantees, and practices that read as unfair or deceptive under EU and US consumer law.
---

# Consumer Rights Compliance Review

Consumer protection law sets a floor that no checkout flow, product page, or support script may undercut. This skill trains the advisor to review B2C-facing work against the core guarantees of EU Directive 2011/83/EU on consumer rights and the FTC Act Section 5 bar on unfair or deceptive acts or practices. Findings are review flags for discussion with qualified counsel, never legal advice.

## Watch for
- Missing or incomplete pre-contract information: trader identity, total price, delivery arrangements, complaint handling.
- Statutory rights waived or diluted in copy ("all sales final", "no refunds under any circumstances").
- Pre-ticked boxes or other default-paid add-ons.
- Order buttons that do not clearly signal a payment obligation (EU "order with obligation to pay").
- Vague or misleading claims about guarantees, returns, or delivery times.
- Divergent treatment of EU vs US customers with no documented rationale.
- Support scripts that discourage consumers from exercising statutory rights.
- Mandatory disclosures buried below the fold or behind extra clicks.

## Best practices
- Map each mandatory 2011/83/EU information item to the exact screen where it appears before the order is placed.
- Apply the FTC Section 5 lens: would a reasonable consumer be misled, and does the practice cause unjustifiable injury?
- Keep statutory-rights language separate from, and never overridden by, commercial policy wording.
- Require an explicit, unticked consent control for every additional paid item.
- Verify the order-confirmation step states the payment obligation and total price clearly.
- Flag jurisdiction-specific requirements (EU, UK, US states) as open questions for counsel rather than guessing.
- Record evidence: screenshots or DOM snapshots of what the consumer actually sees.
- Route legal-risk findings to qualified counsel; the advisor flags, counsel decides.

## Quick checklist
- [ ] Trader identity and contact details visible before order.
- [ ] Total price incl. taxes and unavoidable fees shown pre-order.
- [ ] Delivery, payment, and complaint-handling arrangements disclosed.
- [ ] No pre-ticked boxes or default-paid add-ons.
- [ ] Order button clearly signals payment obligation.
- [ ] Statutory rights not waived or diluted anywhere in copy.
- [ ] No claim a reasonable consumer would read as deceptive.
- [ ] Legal-risk items escalated to counsel, not self-adjudicated.
