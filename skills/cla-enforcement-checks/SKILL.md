---
name: cla-enforcement-checks
description: Equips the advisor to verify contributor licensing paperwork — CLA signatures or DCO sign-offs — and flag contributions accepted without proper authorization.
---

# CLA Enforcement Checks

Open-source projects receive code under either a Contributor License Agreement (a signed contract granting rights) or a Developer Certificate of Origin (a per-commit sign-off asserting rights). Missing or mismatched paperwork means the project may lack the rights it claims to distribute. The advisor audits the contribution record against the project's chosen mechanism.

## Watch for
- Pull requests merged from contributors with no CLA on file and no DCO sign-off.
- DCO sign-offs using anonymous handles, or "Signed-off-by" lines added by automation rather than the author.
- CLA signed by an individual but commits arriving from a corporate account (employer rights unresolved).
- Corporate CLAs missing for contractors whose employers own their work product.
- CLA version drift: signatures under v1 while the project now requires v2 terms.
- Forks or vendored code imported wholesale without per-author paperwork.
- License headers in files contradicting the CLA/DCO terms.
- No automation: paperwork checked manually and inconsistently.

## Best practices
- Pick one mechanism (CLA or DCO) and state it in CONTRIBUTING.md.
- Automate enforcement with a CLA bot or DCO check that blocks merges.
- Verify signer identity matches commit author email and name.
- Track corporate CLAs separately and map employee contributors to them.
- Re-check paperwork on re-licensing or license-version changes.
- Keep a signature audit trail: who, when, which version, under what identity.
- Remediate gaps by obtaining retroactive sign-off or removing the contribution.
- Document exceptions (e.g., trivial-patch policies) explicitly.

## Quick checklist
- [ ] Contribution mechanism (CLA/DCO) declared in the repo
- [ ] Merge blocking enforced automatically
- [ ] Every merged commit has valid sign-off or CLA
- [ ] Signer identity matches commit author
- [ ] Corporate contributors covered by entity CLA
- [ ] CLA version consistent with current license
- [ ] Imported/vendored code paperwork verified
- [ ] Gaps remediated or documented
