---
name: npm-dependency-audit
description: Equips the advisor to review npm dependency changes for known vulnerabilities, abandoned packages, and supply-chain risk before they merge.
---

# npm Dependency Audit

Every new or bumped package is code someone else wrote running with your privileges. Reviewers treat dependency diffs as first-class security surface: check advisories, maintenance signals, and install scripts, and keep the tree as small and pinned as the project allows.

## Watch for
- `npm audit` reporting high/critical findings introduced by the diff.
- New packages with a single maintainer, no repo, or last publish years ago.
- Install scripts (`preinstall`/`postinstall`) added by a dependency update.
- Typosquat names one character off a popular package.
- A small utility pulling a deep transitive tree (check bundlephobia/dep count).
- Unpinned ranges (`*`, `latest`, broad `^`) on security-sensitive packages.
- Duplicated versions of the same package bloating the tree.
- Lockfile churn that does not match the declared package.json change.

## Best practices
- Run `npm audit` and `npm audit signatures` on every dependency diff.
- Check the package's repo activity, issue response, and download trend before adopting.
- Prefer built-ins or tiny zero-dep modules for trivial utilities.
- Pin or tightly range security-critical packages; review every major bump changelog.
- Use `overrides` to force patched transitive versions when upstream lags.
- Ignore audit findings only with a recorded reason, never silently.
- Rebuild the lockfile from a clean install when churn looks inconsistent.
- Gate CI on audit level so regressions cannot merge unnoticed.

## Quick checklist
- [ ] `npm audit` clean (or findings explicitly triaged) after the change.
- [ ] New packages checked for maintenance health and typosquatting.
- [ ] No unexpected install scripts introduced.
- [ ] Transitive tree size justified for what the package provides.
- [ ] Ranges pinned appropriately for security-sensitive deps.
- [ ] No accidental duplicate versions of one package.
- [ ] Lockfile changes match the package.json intent exactly.
- [ ] CI enforces an audit gate on dependency PRs.
