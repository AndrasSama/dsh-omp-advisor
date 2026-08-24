---
name: supply-chain-risk-mgmt
description: Equips the advisor to assess vendor security risk, SBOM coverage, and third-party access reviews across the software and service supply chain.
---

# Supply Chain Risk Management

Supply chain risk management treats vendors, libraries, and service providers as part of the organization's attack surface. Key levers are vendor risk assessment at onboarding, software bills of materials (SBOM) for component visibility, and periodic review of third-party access. The advisor checks whether these levers actually operate rather than exist on paper.

## Watch for
- Vendors onboarded without a security questionnaire or risk tiering.
- No SBOM generated or requested, or SBOMs in inconsistent formats (SPDX vs CycloneDX) with no ingestion path.
- Third-party accounts with standing privileged access and no periodic recertification.
- Vendor access left active after contract end or project completion.
- Critical dependencies with a single maintainer, no security contact, or unmaintained status.
- No contractual security clauses (breach notification, audit rights, subprocessor transparency).
- Concentration risk: one vendor or cloud region underpinning multiple critical services.
- No process to propagate vendor-advised vulnerabilities into internal patching.

## Best practices
- Tier vendors by data access and criticality; scale assessment depth to tier.
- Require and ingest SBOMs (SPDX/CycloneDX) from software suppliers; match against vulnerability feeds.
- Recertify all third-party access on a fixed schedule; revoke automatically on contract end.
- Put security terms in contracts: notification timelines, audit rights, subprocessor lists.
- Track critical open-source dependencies for maintenance health, not just CVEs.
- Maintain a vendor risk register with review dates and exception records.
- Test vendor incident-notification paths with at least tabletop scenarios.
- Monitor for concentration and geopolitical risk across critical suppliers.

## Quick checklist
- [ ] Vendors tiered and assessed at onboarding
- [ ] SBOMs collected and matched to vuln feeds
- [ ] Third-party access recertified on schedule
- [ ] Offboarding revokes access automatically
- [ ] Contracts carry security and notification clauses
- [ ] Critical dependency health tracked
- [ ] Vendor risk register current
- [ ] Vendor incident notification tested
