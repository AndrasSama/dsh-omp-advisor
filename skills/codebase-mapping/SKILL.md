---
name: codebase-mapping
description: Equips the advisor to verify that documentation accurately maps the real codebase structure, entry points, and module boundaries.
---

# Codebase Mapping

Codebase mapping is the discipline of keeping written documentation anchored to the repository as it actually exists: real paths, real entry points, real module boundaries.
Docs rot when they describe an idealized architecture; a reviewer must be able to diff prose against the tree and catch every divergence.

## Watch for
- Doc paths that no longer exist in the repo (moved or renamed directories referenced verbatim)
- Architecture diagrams whose boxes do not correspond to any package, service, or module in the tree
- Entry points described incorrectly: wrong binary, wrong main file, wrong startup command
- "See X for details" pointers to files that were deleted or split in recent commits
- Circular or hand-wavy dependency descriptions that contradict the actual import graph
- Monorepo docs that conflate packages or attribute code to the wrong workspace
- Setup instructions that skip a required build or codegen step visible in the package manifests

## Best practices
- Verify every file path mentioned in a doc against the current tree before approving
- Anchor architecture prose to importable units: package names, module paths, service names
- Regenerate or re-verify diagrams whenever the diff touches module boundaries
- Document the actual build/run commands taken from manifest scripts, not from memory
- Keep one top-level map page linking to per-module pages; review both when either changes
- Prefer links to stable doc pages over deep links into source files
- When a refactor lands, treat every doc mentioning the old names as suspect until re-verified

## Quick checklist
- [ ] Every path in the diff exists in the current tree
- [ ] Entry point and run commands match manifest scripts
- [ ] Diagram nodes map 1:1 to real packages/services
- [ ] Cross-references resolve to live pages
- [ ] Module ownership matches the actual import direction
- [ ] New directories introduced by the change are reflected in the map
- [ ] No orphaned references to deleted files
