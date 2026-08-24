---
name: package-lock-hygiene
description: Equips the advisor to detect lockfile drift, unsafe regeneration, and integrity problems in npm package-lock.json that break reproducible installs.
---

# Package Lock Hygiene

The lockfile is the reproducibility contract: package.json declares intent, package-lock.json pins reality. Reviewers flag drift between the two, casual lockfile deletion, and integrity changes that signal anything from a bad merge to a supply-chain substitution.

## Watch for
- Lockfile changes in a PR whose package.json did not change (or vice versa).
- `resolved` URLs switching registries or integrity hashes changing on unchanged versions.
- Lockfile deleted and regenerated casually, churning hundreds of entries.
- `package-lock.json` missing entirely from a repo that ships or deploys code.
- Mixed lockfiles (yarn.lock + package-lock.json) in one repo.
- `npm install` run where `npm ci` should be used in CI/CD.
- Lockfile version older than the npm major in use (lockfileVersion mismatch).
- Git merge artifacts or conflict markers left in the lockfile.

## Best practices
- Commit the lockfile; treat unrelated churn as a review blocker.
- Use `npm ci` in CI and containers for exact, fast, reproducible installs.
- Regenerate deliberately (`rm` + fresh install) only when churn is the goal, and say so.
- Scrutinize integrity-hash changes on pinned versions — verify against the registry.
- Keep one package manager per repo; remove stray lockfiles from others.
- Bump lockfileVersion by upgrading npm consistently across the team.
- Resolve lockfile conflicts by reinstalling from the merged package.json, never by hand-editing.
- Pin the Node/npm version (engines + CI) so lockfile semantics stay stable.

## Quick checklist
- [ ] Lockfile changes match the package.json diff exactly.
- [ ] No unexplained resolved-URL or integrity-hash changes.
- [ ] CI uses `npm ci`, not `npm install`.
- [ ] Lockfile committed and free of conflict markers.
- [ ] Exactly one lockfile flavor in the repo.
- [ ] lockfileVersion consistent with the team's npm major.
- [ ] Regeneration (if any) is intentional and explained.
- [ ] Node/npm versions pinned via engines and CI.
