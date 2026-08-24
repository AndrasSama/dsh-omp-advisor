---
name: gdpr-data-mapping
description: Equips the advisor to verify that records of processing under GDPR Article 30 are complete, role-accurate, and linked to lawful bases and retention criteria.
---

# GDPR Data Mapping

Data mapping builds the record of processing activities (RoPA) required by GDPR Article 30: what personal data flows where, why, under whose authority, and for how long. It is the foundation every other compliance duty rests on — DPIAs, SARs, breach response, and vendor review all start from the map. An incomplete or stale map invalidates downstream conclusions.

## Watch for
- Processing activities missing Article 30 fields: purposes, data-subject categories, personal-data categories, recipients, transfers, retention, security measures.
- Data flows described without assigning controller/processor roles per party.
- Special-category data (Article 9) present but not flagged for its stricter basis requirements.
- Retention expressed as "as long as necessary" without defined criteria or schedules.
- Sub-processors and onward transfers absent from the map.
- Shadow processing: undocumented systems handling personal data (spreadsheets, unapproved SaaS).
- No versioning or update trigger after system or process changes.
- Processing activities not linked to their lawful basis or DPIA status.

## Best practices
- Build one RoPA entry per processing activity with all Article 30(1)/(2) fields populated.
- Classify each party as controller, joint controller, or processor; record joint-controller arrangements under Article 26.
- Flag special categories (Article 9) and criminal-offense data (Article 10) for enhanced basis and security review.
- Define retention with specific criteria or schedules per data category, tied to the purpose.
- Map all recipients, including processors and sub-processors, with transfer mechanisms for non-EU/EEA recipients.
- Reconcile the map against actual systems (SSO logs, SaaS inventory, access reviews) to catch shadow processing.
- Version the RoPA and trigger updates on system, vendor, or process changes.
- Link each activity to its Article 6 basis, any Article 9 condition, and its DPIA status.

## Quick checklist
- [ ] Article 30 fields complete per activity.
- [ ] Controller/processor roles assigned.
- [ ] Special categories flagged.
- [ ] Retention criteria specific.
- [ ] Sub-processors and transfers mapped.
- [ ] Shadow processing reconciled.
- [ ] Lawful basis linked per activity.
