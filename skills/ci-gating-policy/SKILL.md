---
name: ci-gating-policy
description: Equips the advisor to audit CI pipeline gates, branch protections, and merge policies for bypass paths and missing enforcement.
---

# CI Gating Policy

CI gating is only as strong as its weakest bypass: a required check that can be skipped, an admin override, a branch that is not protected.
Reviewing gate policy means tracing every path from commit to production and asking whether a malicious or careless change could merge without passing the controls that are supposed to catch it.

## Watch for
- Branch protection gaps: main/master mergeable without required status checks, or reviews satisfiable by the PR author
- [skip ci] / [ci skip] markers honored on protected branches
- Security scans configured as advisory (warn-only) instead of blocking
- Self-approval paths: CODEOWNERS missing, or owners able to approve their own changes to sensitive paths
- In-repo workflow files that run with write tokens on pull_request, letting any PR author edit the pipeline
- Secrets exposed to forked PR pipelines (pull_request_target with checkout of PR code)
- Deploy gates weaker than merge gates: production reachable via a path that skips checks

## Best practices
- Require on protected branches: passing CI, at least one non-author approval, up-to-date branch, no force-push, no self-approval
- Make security gates blocking: SAST, secret scan, dependency scan, and license checks fail the build
- Run untrusted PR code with read-only tokens and no secrets; reserve privileged contexts for post-merge
- Pin actions and pipeline dependencies by commit SHA, not mutable tags
- Gate deploys on the same checks as merge plus environment approvals; audit every deploy path
- Log and alert on gate overrides (admin merges, bypassed checks) with reviewer identity
- Test the gates: periodically attempt a known-bad change and confirm it cannot merge

## Quick checklist
- [ ] Protected branches require checks, review, and up-to-date branch
- [ ] No [skip ci] honored on protected branches
- [ ] Security scans block, not warn
- [ ] Authors cannot approve or self-merge sensitive changes
- [ ] Forked PRs run without secrets and with read-only tokens
- [ ] Pipeline actions pinned by SHA
- [ ] Every deploy path passes the merge gates
