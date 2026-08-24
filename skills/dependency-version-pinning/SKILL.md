---
name: dependency-version-pinning
description: Equips the advisor to review dependency version ranges for reproducibility risk — floating ranges, surprise majors, and the trade-offs of exact pins.
---

# Dependency Version Pinning

Version ranges trade reproducibility for convenience: a `^` that was safe at adoption can pull a broken minor next install. Reviewers check that each dependency's range matches its risk profile — tight for security-critical and unstable packages, looser only where semver discipline is proven.

## Watch for
- `*` or `latest` on anything that ships to production.
- Broad `^` ranges on packages with a history of breaking "minor" releases.
- Different services in one repo floating to different versions of a shared dep.
- Major bumps arriving silently through range resolution instead of a deliberate PR.
- Exact pins without a lockfile, or a lockfile that the range could still drift under.
- Pre-release tags (`-beta`, `-rc`) in production ranges.
- Peer dependency ranges that silently conflict after a bump.
- Ranges widened to dodge a bug instead of fixing or pinning around it.

## Best practices
- Default to caret ranges plus a committed lockfile; the lockfile is the real pin.
- Pin exactly (no range) for security-critical, unstable, or patched-fork packages.
- Make major bumps explicit: a PR per major with changelog review, never range drift.
- Keep shared dependencies at one version across services (single source of truth).
- Use `overrides`/`resolutions` to pin transitives when upstream ranges are unsafe.
- Exclude pre-releases from production ranges; opt in per package deliberately.
- Verify peer-dependency compatibility after every bump of a framework-adjacent package.
- Automate updates (Renovate/Dependabot) so bumps are small, frequent, and reviewable.

## Quick checklist
- [ ] No `*`/`latest` in production dependency ranges.
- [ ] Range width matches each package's risk and semver history.
- [ ] Lockfile committed and consistent with declared ranges.
- [ ] Major version bumps happen via explicit reviewed PRs.
- [ ] Shared deps unified to one version across services.
- [ ] No pre-release tags in production ranges.
- [ ] Peer-dependency conflicts checked after bumps.
- [ ] Update automation configured for small, reviewable bumps.
