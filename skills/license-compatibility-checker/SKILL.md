---
name: license-compatibility-checker
description: Equips the advisor to detect open-source license incompatibilities between inbound dependencies and outbound distribution obligations.
---

# License Compatibility Checker

OSS license compatibility review determines whether code under one license may be combined with, linked against, or redistributed under another. Inbound obligations (licenses of dependencies coming in) and outbound obligations (the license under which the product ships) can differ, and mixing permissive with copyleft code can propagate requirements. The advisor flags combinations that risk imposing unintended obligations on the distributor.

## Watch for
- GPL/AGPL dependencies linked into a proprietary or permissive-licensed binary that will be distributed.
- LGPL libraries statically linked instead of dynamically linked, without object files or relinking instructions.
- Apache-2.0 code (patent clause) combined with GPLv2-only code, an incompatible pairing.
- Dual-licensed dependencies where one license was chosen but the other's terms were assumed to apply.
- Missing or stripped LICENSE files and copyright notices in vendored code.
- Conflicting copyleft flavors in one dependency tree (e.g., MPL-2.0 file-level copyleft beside GPLv3 distribution terms).
- SPDX identifiers that are absent, wrong, or contradict the actual license text.
- Transitive dependencies whose licenses were never reviewed, only the direct ones.

## Best practices
- Build a full dependency inventory with declared licenses (SBOM or license-scanner output) before judging compatibility.
- Classify each license as permissive, weak copyleft, or strong copyleft, and map the flow inbound → outbound.
- Verify the distribution trigger: copyleft obligations generally attach on distribution/conveying, not private use.
- Prefer dynamic linking plus required notices and relinking material for LGPL components.
- For dual-licensed packages, record explicitly which license was chosen and why.
- Keep attribution and license texts with every redistributed permissive component.
- Escalate to qualified counsel when strong copyleft meets proprietary distribution plans.
- Record compatibility decisions and rationale in a license review log.

## Quick checklist
- [ ] Full dependency tree inventoried with declared licenses
- [ ] Inbound vs outbound license combination mapped
- [ ] Strong copyleft checked against distribution plans
- [ ] LGPL linkage style (dynamic vs static) verified
- [ ] License texts and copyright notices preserved
- [ ] Dual-license choice documented
- [ ] SPDX identifiers match actual license files
- [ ] Unclear cases escalated to counsel
