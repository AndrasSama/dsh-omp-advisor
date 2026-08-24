---
name: right-to-be-forgotten-exec
description: Equips the advisor to verify erasure requests are lawfully grounded, propagated to backups and processors, and reconciled against retention obligations.
---

# Right to Be Forgotten Execution

Erasure under GDPR Article 17 is a verified-ground, whole-system operation: the primary database, backups, logs, processors, and disclosed copies all need handling, and Article 17(3) exceptions must be assessed before anything is deleted. Review checks the decision chain — ground, exceptions, propagation, confirmation — not just the primary delete.

## Watch for
- Erasure applied only in the primary system, leaving backups, logs, and downstream processors untouched.
- Article 17(1) grounds not verified (withdrawn consent, purpose fulfilled, objection upheld, unlawful processing, legal obligation, information-society services offered to a child).
- Article 17(3) exceptions not assessed: legal obligation, public interest, public health, archiving/research/statistics, legal claims.
- Article 19 duty ignored: recipients and other controllers not notified of the erasure.
- No suppression list where erasure conflicts with re-collection risk (e.g., marketing suppression).
- Data needed for active contracts or tax/legal retention erased without legal review.
- No confirmation that processors and sub-processors actually deleted.
- Response to the requester missing what was erased, what was retained, and on what basis.

## Best practices
- Verify the Article 17(1) ground and assess Article 17(3) exceptions before erasing; document the decision.
- Propagate erasure to backups (within a defined rotation schedule), logs, and all processors with confirmation.
- Notify controllers to whom the data was disclosed per Article 19, unless impossible or disproportionate effort.
- Maintain suppression lists where needed to prevent re-processing (do-not-contact).
- Handle retention conflicts explicitly: keep what law requires, erase the rest, document the split.
- Apply the same one-month response discipline as other data-subject requests.
- Collect deletion confirmations from processors and retain them for accountability.
- Respond with what was erased, what was retained and why, and the right to lodge a supervisory complaint.

## Quick checklist
- [ ] Article 17(1) ground verified.
- [ ] Article 17(3) exceptions assessed.
- [ ] Backups and logs covered.
- [ ] Processor deletions confirmed.
- [ ] Article 19 notifications made.
- [ ] Suppression list maintained.
- [ ] Retention conflicts documented.
