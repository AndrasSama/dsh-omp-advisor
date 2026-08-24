---
name: email-drip-sequencing
description: Equips the advisor to audit email drip sequences for cadence, segmentation, deliverability, and per-email purpose.
---

# Email Drip Sequencing

Drip sequence review treats each automated email as earning its place in the inbox: one job per email, a cadence matched to the buyer's timeline, and list hygiene that protects deliverability.
The reviewer walks the sequence as the recipient would experience it — including what happens when they ignore it, click, or unsubscribe.

## Watch for
- Emails with no single measurable job: newsletter-ish blasts inside a conversion sequence
- Cadence mismatch: daily emails for a considered B2B purchase, or monthly touches for an abandoned cart
- No branching: the sequence ignores opens, clicks, or conversions and keeps emailing people who already bought
- Subject lines that don't survive the inbox preview: over ~50 characters, clickbait, or spam-trigger patterns (ALL CAPS, "FREE!!!")
- Missing or buried unsubscribe, no physical address (CAN-SPAM), or inconsistent sender identity
- Sending from no-reply addresses that kill replies and trust
- No re-engagement or sunset path for chronically unengaged subscribers, dragging deliverability for everyone

## Best practices
- Assign each email one job and one CTA; name the job in the sequence doc (e.g., "Email 2: overcome the setup objection")
- Space by decision timeline: welcome series over days, nurture over weeks, enterprise cycles over months
- Branch on behavior: converters exit to onboarding; clickers get deeper content; ghosters get re-engagement then sunset
- Write subject lines ≤ ~50 chars with a curiosity or benefit hook; preheader text extends, not repeats, them
- Deliverability basics: authenticated domain (SPF/DKIM/DMARC), warm-up for new domains, plain-text option, easy unsubscribe
- Send from a named person at the company domain; allow replies
- Measure per-email: open, CTR, and sequence-level conversion to the goal — prune emails that don't move the goal

## Quick checklist
- [ ] Every email has one stated job and one CTA
- [ ] Cadence matches the purchase/decision timeline
- [ ] Branching exits converters and handles non-responders
- [ ] Subject lines ≤ ~50 chars, no spam-trigger patterns
- [ ] CAN-SPAM basics: unsubscribe + postal address present
- [ ] SPF/DKIM/DMARC authenticated; human sender name
- [ ] Underperforming emails pruned by per-email metrics
