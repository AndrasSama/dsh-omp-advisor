---
name: unacceptable-risk-flagging
description: Equips the advisor to screen AI systems against the EU AI Act Article 5 prohibited practices and escalate detections as hard stops.
---

# Unacceptable Risk Flagging

Article 5 of the EU AI Act prohibits specific practices outright — manipulation, exploitation of vulnerabilities, social scoring, untargeted facial-image scraping, workplace/education emotion recognition, sensitive-attribute biometric categorization, and narrowly-circumscribed real-time remote biometric identification. A detected prohibited practice is a hard stop, not a mitigation question. Review screens actual use, not just stated purpose.

## Watch for
- Manipulative or subliminal techniques materially distorting behavior and causing significant harm.
- Exploitation of vulnerabilities due to age, disability, or social/economic situation.
- Social scoring leading to detrimental or disproportionate treatment, by or on behalf of public authorities or private actors.
- Untargeted scraping of facial images from the internet or CCTV to build face-recognition databases.
- Emotion recognition in the workplace or education institutions (except medical or safety reasons).
- Biometric categorization inferring sensitive attributes (race, political opinions, religion, sexual orientation).
- Real-time remote biometric identification in public spaces for law enforcement outside the narrow statutory exceptions.
- Screening done on intended purpose only, while actual deployment differs.

## Best practices
- Screen every AI system against the full Article 5 list before classification; document the screening.
- Assess actual use, not just intended purpose — benign-purpose systems deployed manipulatively remain prohibited.
- Escalate borderline cases (emotion recognition outside listed contexts, nudging features) to legal review rather than self-clearing.
- Note the stakes: prohibitions apply from 2 Feb 2025 with penalties up to €35 million or 7% of global annual turnover (Article 99).
- Check national implementations and sectoral rules that may add prohibitions.
- Treat any detected prohibited use as a hard stop: flag for immediate halt and escalation.
- Keep screening records in the compliance file.
- Train product teams on the prohibited list so flags arise at design time.

## Quick checklist
- [ ] Full Article 5 screening performed.
- [ ] Actual use assessed, not just purpose.
- [ ] Emotion-recognition context checked.
- [ ] Biometric categorization/sensitive inference checked.
- [ ] Manipulation/vulnerability exploitation checked.
- [ ] Borderline cases escalated to legal.
- [ ] Screening documented and retained.
