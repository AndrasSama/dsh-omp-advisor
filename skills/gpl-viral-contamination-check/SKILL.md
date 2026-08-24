---
name: gpl-viral-contamination-check
description: Equips the advisor to detect GPL/LGPL/AGPL linking and distribution triggers that could impose copyleft obligations on proprietary code.
---

# GPL Viral Contamination Check

Strong copyleft licenses (GPL, AGPL) require derivative works to be distributed under the same terms, so how a component is linked, combined, and delivered determines whether obligations propagate. The AGPL adds a network-use obligation the GPL lacks, which changes the analysis for SaaS. The advisor reviews architecture and distribution models for triggers — this is risk flagging, not legal advice.

## Watch for
- GPL libraries statically linked into proprietary executables that are distributed to customers.
- GPL code and proprietary code compiled into a single binary or combined as in-process plugins.
- AGPL components used in network services offered to third parties without source availability.
- "It's SaaS, so GPL doesn't apply" assumptions that ignore AGPL or customer-facing distribution.
- Confusion between GPL developer tools (output usually unaffected) and GPL runtime libraries that ship.
- Containers or firmware images bundling GPL userland without a corresponding source offer.
- LGPL used statically without providing object files or relinking instructions.
- Copyleft code copied into proprietary modules "temporarily" and never removed.

## Best practices
- Map every GPL-family component's linkage style: separate process, dynamic link, static link, or in-process.
- Distinguish distribution (GPL trigger) from network use (AGPL trigger) for each deployment model.
- Prefer process isolation (separate executables over pipes/sockets) for GPL components where appropriate.
- For LGPL, ship dynamic linkage plus object files or relinking instructions.
- Keep a written source-offer or source-availability plan for any GPL that is distributed.
- Enforce a policy gate: strong copyleft requires explicit approval before entering the product.
- Document isolation decisions in architecture records so future refactors don't merge boundaries.
- Escalate borderline cases (plugins, shared memory, header-only use) to counsel.

## Quick checklist
- [ ] All GPL/LGPL/AGPL components identified in the dependency tree
- [ ] Linkage style recorded for each copyleft component
- [ ] Distribution vs network-use trigger assessed per component
- [ ] AGPL checked against any externally offered service
- [ ] Isolation boundaries documented in architecture
- [ ] Source-offer plan exists for distributed GPL
- [ ] Strong-copyleft additions passed policy approval
- [ ] Borderline cases escalated to counsel
