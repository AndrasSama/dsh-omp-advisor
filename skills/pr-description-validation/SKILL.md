---
name: pr-description-validation
description: Equips the advisor to check that pull requests carry the context reviewers and future archaeologists need — motivation, behavior changes, test evidence, and rollback notes.
---

# PR Description Validation

A merge commit outlives the PR conversation; when the description is empty, the "why" dies with the chat log. Reviewers require each PR to state what changes, why, how it was tested, and what could go wrong — and treat missing context as a review blocker, not a style preference.

## Watch for
- Empty or one-word descriptions on non-trivial diffs.
- No stated motivation: the diff shows what, never why.
- Behavior changes (defaults, APIs, schemas) not called out explicitly.
- Missing test evidence — no mention of how the change was verified.
- No migration or rollback notes for changes that need them.
- Descriptions that restate the diff instead of explaining intent.
- Linked issues/tickets absent when the work tracks against one.
- Screenshots or before/after missing for user-visible UI changes.

## Best practices
- Require a template: Summary, Motivation, Behavior changes, Testing, Rollback.
- Make "behavior changes" a mandatory section — reviewers scan it first.
- Demand concrete test evidence: commands run, scenarios covered, links to runs.
- For risky changes, require a rollback plan in the description before approval.
- Link tracked issues/tickets so the PR joins the decision history.
- UI changes need visuals; API changes need before/after examples.
- Keep descriptions updated as the PR evolves — stale context misleads.
- Enforce with CI or branch protection where the team agrees; otherwise review culture.

## Quick checklist
- [ ] Summary and motivation present and non-trivial.
- [ ] Behavior/API/schema changes explicitly listed.
- [ ] Testing section names how the change was verified.
- [ ] Rollback or migration notes included for risky changes.
- [ ] Related issues/tickets linked.
- [ ] UI changes include screenshots; API changes include examples.
- [ ] Description kept current with the final diff.
- [ ] Template enforced by tooling or consistent review practice.
