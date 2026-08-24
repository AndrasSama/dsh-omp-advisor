---
name: release-notes-summarization
description: Equips the advisor to review release notes for user-impact clarity, breaking-change visibility, and changelog hygiene.
---

# Release Notes Summarization

Release notes translate a diff into consequences for users: what changed, what breaks, and what to do about it.
The review bar is strict: a reader who skims headings must not be able to miss a breaking change, and every entry must say what it means for the user — not what the engineer did.

## Watch for
- Breaking changes buried in a bullet list with no dedicated section or badge
- Engineer-centric entries ("refactored X module") that state no user-visible effect
- Missing migration steps for changes that require user action
- Vague entries: "various bug fixes", "performance improvements" with no specifics
- Semver level inconsistent with change scope (a breaking change shipped as a patch)
- Deprecations announced without a removal timeline
- Internal-only changes (CI, test infra) mixed into user-facing notes

## Best practices
- Structure per Keep a Changelog: Added, Changed, Deprecated, Removed, Fixed, Security — with Breaking Changes called out first
- Write each entry as user impact: what behaves differently, for whom, and what to do
- Every breaking change gets: what breaks, who is affected, exact migration steps
- Match semver to scope: any breaking change is a major bump, and the notes say so
- Link each entry to the PR/issue for traceability, but keep the prose self-contained
- Separate internal chores into a non-user-facing section or omit them entirely
- Review notes against the actual merged diff, not the PR titles

## Quick checklist
- [ ] Breaking changes have their own section at the top
- [ ] Every entry states user-visible impact
- [ ] Migration steps included for anything requiring user action
- [ ] No "various fixes" vagueness
- [ ] Semver level matches change scope
- [ ] Deprecations carry a removal date
- [ ] Notes reconcile with the merged diff
