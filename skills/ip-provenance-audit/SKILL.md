---
name: ip-provenance-audit
description: Equips the advisor to verify code origin records and flag copied, vendored, or unknown-provenance code before it creates ownership or infringement exposure.
---

# IP Provenance Audit

Provenance auditing traces every piece of code in a repository back to its author or upstream source. Without clear origin records, an organization cannot prove ownership, cannot honor license terms, and inherits unknown infringement risk. The advisor reviews contribution records, commit history, and vendored code for gaps in origin evidence.

## Watch for
- Large code drops appearing in a single commit with no author history or review trail.
- Vendored third-party directories missing LICENSE, NOTICE, or upstream URL references.
- Commit authorship inconsistent with employment or contractor records (commits by unknown identities).
- Code blocks matching known upstream projects verbatim, including comments and typos.
- Copy-paste indicators: foreign variable naming, stale TODOs, references to another product.
- Contributions from anonymous accounts or shared credentials.
- Forked repositories whose upstream history was squashed or stripped.
- AI-generated code with no record of the generation tool, usage policy, or output licensing terms.

## Best practices
- Require signed commits or DCO/CLA sign-off so every change has an attributable author.
- Keep upstream references (URL, version, commit hash) for all vendored code.
- Run similarity/clean-room scans on imported code before merging it into the mainline.
- Maintain a contribution register linking commits to contributor identity and agreement status.
- Document provenance decisions (origin, license, review date) in an audit ledger.
- Quarantine code of unknown origin until provenance is established or it is rewritten.
- Track AI-assisted code under the organization's AI-use policy.
- Re-audit provenance after acquisitions or repository merges.

## Quick checklist
- [ ] Every file traceable to an author or upstream source
- [ ] Vendored code carries license and upstream references
- [ ] Commit identities match known contributors
- [ ] No verbatim upstream code without attribution
- [ ] Contribution agreements on file for all authors
- [ ] Unknown-origin code quarantined or cleared
- [ ] AI-generated code recorded per policy
- [ ] Audit ledger updated with findings
