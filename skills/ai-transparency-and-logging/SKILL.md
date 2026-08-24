---
name: ai-transparency-and-logging
description: Equips the advisor to verify high-risk AI systems implement Article 12 automatic logging, Article 13 instructions for use, and Article 50 user-facing transparency.
---

# AI Transparency & Logging

Transparency and logging make AI systems auditable: automatic event logs (Article 12), complete instructions for deployers (Article 13), and user-facing disclosures for certain systems (Article 50). Review tests whether a flagged output can actually be traced back to its inputs, and whether deployers received what they need to meet their own duties.

## Watch for
- High-risk systems without automatic logging capability (Article 12), or logs not retained.
- Instructions for use missing or incomplete (Article 13): capabilities, limitations, performance, oversight measures.
- Logs that cannot reconstruct a specific decision — no capture of decision-relevant inputs and outputs.
- Article 50 transparency missing: chatbots not disclosed as AI, synthetic content unmarked.
- Log retention undefined or shorter than needed for post-market monitoring and incident investigation.
- Logs unprotected against tampering or unauthorized access.
- Deployers not given the information needed for their own transparency obligations.
- No traceability across the lifecycle: model versions, updates, and configuration changes unlogged.

## Best practices
- Implement automatic event logging covering at minimum: operations, timestamps, decision-relevant inputs/outputs, and errors (Article 12).
- Provide complete instructions for use per Article 13: intended purpose, limitations, performance metrics, human-oversight measures, expected lifetime.
- Define log retention aligned with risk and any sectoral minimums.
- Protect log integrity: append-only storage, access controls, tamper detection.
- Ensure logs enable reconstruction of individual decisions for audits and incident investigation.
- Apply Article 50 duties: disclose AI interaction to users, mark synthetic content machine-readably.
- Give deployers a complete information package, including log access where needed.
- Test logging coverage: can an auditor trace a flagged output back to its inputs?

## Quick checklist
- [ ] Automatic logging implemented (Article 12).
- [ ] Instructions for use complete (Article 13).
- [ ] Retention period defined and adequate.
- [ ] Logs tamper-protected.
- [ ] Decision reconstruction possible.
- [ ] Article 50 disclosures present.
- [ ] Deployer information package complete.
