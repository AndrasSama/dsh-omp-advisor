---
name: copyright-training-audit
description: Equips the advisor to audit AI training data for copyright provenance, TDM opt-out compliance, and GPAI provider obligations under the AI Act and DSM Directive.
---

# Copyright Training Audit

Training-data copyright review traces provenance and rights status of every source, checks text-and-data-mining reservations, and verifies GPAI provider duties. In the EU, Directive (EU) 2019/790 Article 4 lets rightsholders reserve TDM rights machine-readably, and AI Act Article 53 requires a copyright policy and a training-data summary. Jurisdiction matters: EU TDM exceptions and US fair use do not transfer across borders.

## Watch for
- No training-data inventory — sources, licenses, and acquisition methods unknown.
- TDM opt-outs ignored: machine-readable rights reservations (robots.txt, metadata flags) under DSM Article 4(3) not honored or not checked.
- Scraped content included despite explicit license or terms-of-service prohibitions.
- No copyright policy for GPAI training as required by Article 53(1)(c) of the AI Act.
- No publicly available training-data summary per Article 53(1)(d) and the AI Office template.
- Licensed, scraped, public-domain, and user-generated sources not distinguished in the inventory.
- Memorization unassessed: can the model reproduce substantial parts of specific training works?
- Jurisdiction mismatch: US fair-use assumptions applied to EU-trained or EU-deployed models.

## Best practices
- Build a training-data inventory: source, license/terms, acquisition method, TDM-reservation status, volume.
- Honor TDM opt-outs technically (robots.txt, metadata) and document compliance for DSM Article 4(3).
- Adopt and publish a copyright policy per Article 53(1)(c); prepare the training-data summary per the AI Office template.
- Categorize sources by rights status: licensed, public domain, open license, scraped-with-reservation-check, user content.
- Test for memorization and document the methodology and results.
- Assess jurisdiction explicitly: EU TDM exceptions (Articles 3–4 DSM) vs US fair use are different regimes.
- Keep provenance records for licensed data: agreements, scope, term.
- Flag high-risk sources (news, books, image libraries with active enforcement) for legal review.

## Quick checklist
- [ ] Training-data inventory complete.
- [ ] TDM opt-outs honored and documented.
- [ ] Copyright policy adopted (Art 53(1)(c)).
- [ ] Training-data summary prepared (Art 53(1)(d)).
- [ ] Sources categorized by rights status.
- [ ] Memorization testing done.
- [ ] Jurisdictional basis verified.
