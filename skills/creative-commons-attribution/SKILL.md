---
name: creative-commons-attribution
description: Equips the advisor to verify correct Creative Commons license variant handling, complete attribution, and safe license stacking.
---

# Creative Commons Attribution Review

Creative Commons licenses come in six main variants built from the BY, SA, NC, and ND elements, each imposing different obligations on reuse. Attribution (TASL: title, author, source, license) is required by all of them, and mixing CC material with other licenses creates stacking constraints. The advisor checks that reused CC content carries the right variant, complete credit, and compatible downstream terms.

## Watch for
- CC content used with no attribution or a bare link without author and license.
- NC (NonCommercial) material used in a commercial product, marketing, or monetized site.
- ND (NoDerivatives) material modified, cropped, remixed, or translated.
- SA (ShareAlike) material incorporated without licensing the adaptation under the same or a compatible license.
- Mixing CC-BY-SA with CC-BY-NC-SA content (NC and SA stacking conflict).
- CC 4.0 obligations assumed identical to older 3.0/2.0 versions (attribution and SA mechanics differ).
- "CC0" claims on works that still carry third-party rights (trademarks, publicity, model releases).
- Attribution stripped during build pipelines, minification, or CMS imports.

## Best practices
- Record the exact license variant and version for every CC asset (e.g., CC BY-SA 4.0).
- Provide TASL attribution: title, author, source link, license link, and a note of changes.
- Keep attribution with the asset through every distribution format (HTML footer, credits file, app about screen).
- Check SA compatibility before combining: BY-SA adaptations must stay BY-SA or a designated compatible license.
- Treat NC as a hard boundary for anything revenue-related; flag when in doubt.
- Verify ND material is used verbatim, with modifications only where the license version permits.
- Do not imply endorsement by the licensor; remove attribution on request where feasible.
- Maintain an asset register mapping each CC item to its license, source, and attribution text.

## Quick checklist
- [ ] Exact CC variant and version recorded per asset
- [ ] TASL attribution complete and visible
- [ ] NC boundary respected for commercial contexts
- [ ] ND material used unmodified
- [ ] SA obligations propagated to adaptations
- [ ] License stacking conflicts checked
- [ ] Attribution survives all distribution formats
- [ ] Asset register maintained and current
