---
name: side-effect-call-gating
description: Equips the advisor to review mutating or irreversible calls — writes, deletes, shell commands, sends, payments — for blast radius, confirmations, dry-run-first, and reversibility.
---

# Side-Effect Call Gating

Reads are cheap and reversible; mutations are not. This discipline covers gating every side-effecting call — file writes, deletes, shell commands, messages, deploys, payments — against its blast radius and reversibility before it fires. The reviewer's job is to ask of each mutating call: what breaks if this is wrong, can it be undone, and did anyone actually authorize this specific action.

## Watch for
- Irreversible deletes (`rm -rf`, `DROP TABLE`, MCP `forget`/`delete` tools) executed without backup, snapshot, or user confirmation
- Glob or variable expansion in destructive positions: `rm $DIR/*`, `sed -i` across a tree, unquoted paths containing spaces
- Force-pushes, branch deletes, or history rewrites without an explicit user request naming that operation
- First-attempt external sends: email, webhooks, chat messages, or payments fired with no dry run or preview
- Mutating production or remote systems when a local or staging equivalent would have answered the question
- Overwriting files that were never read — `write` without prior observation of the target's current content
- Cascading side effects: one call that triggers deploys, notifications, billing, or downstream pipelines as a side consequence
- Broad permission requests for narrow tasks (full filesystem access where workspace-write would suffice)

## Best practices
- Rank every call on the reversibility ladder: read < write < delete < send < pay; higher rungs need stronger gates
- Dry-run first wherever supported: `--dry-run`, scan/preview modes, `EXPLAIN`, list-before-delete
- Minimize blast radius: explicit paths over globs, single records over batches, idempotent operations over destructive ones
- Require explicit user confirmation for irreversible or externally visible effects — silence is not consent
- Snapshot before bulk mutation: `git commit`, `cp`, an export, or at minimum a recorded list of the targets about to change
- Prefer gated, policy-aware tools over raw shell for the same effect so approval flows actually apply
- Verify after mutating with an independent read-back, and report exactly what changed to the user

## Quick checklist
- [ ] Is every mutating call identified and ranked by reversibility?
- [ ] Any irreversible delete lacking backup or confirmation?
- [ ] Any glob/variable expansion in a destructive command left unexamined?
- [ ] Was a dry-run/preview mode available but skipped?
- [ ] Any external send/deploy/payment attempted as a first try?
- [ ] Any file overwritten without being read first?
- [ ] Is the blast radius the minimum the task requires?
