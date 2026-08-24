---
name: onboarding-guide-structuring
description: Equips the advisor to structure onboarding guides that get a new user to first success fast without missing prerequisites.
---

# Onboarding Guide Structuring

An onboarding guide has one job: take a stranger from zero to a verifiable first success with the minimum necessary concepts.
Reviewing onboarding is reviewing for ruthlessness — every sentence that does not move the reader toward that first success is friction, and every unstated prerequisite is a cliff.

## Watch for
- Prerequisites discovered mid-flow: a required tool, account, or permission first mentioned at step six
- No verifiable success criterion: the user finishes without knowing whether it worked
- Concept dumps before the first hands-on step (architecture essays ahead of "hello world")
- Steps that skip expected output, so users cannot tell they are on track
- Platform assumptions (macOS-only commands, shell-specific syntax) not labeled
- Branching paths (CLI vs UI, cloud vs local) interleaved instead of separated
- Time-blind structure: no sense of how long setup takes or where it can stall

## Best practices
- Open with: what you will build, what you need (complete prerequisite list), estimated time
- Order for first success: minimal path first, options and theory later or linked out
- Every step shows the command/action and the expected observable result
- Verify prerequisites with a check command early (e.g., `node --version`)
- Separate alternate paths into tabs or distinct sections, never mid-sentence
- End with a working artifact plus exactly three next steps ranked by value
- Test the guide cold: a reviewer unfamiliar with the product should be able to follow it literally

## Quick checklist
- [ ] Complete prerequisites listed and checkable up front
- [ ] Time estimate and end-state stated in the intro
- [ ] Every step includes expected output
- [ ] Shortest path to first success; no concept dump before it
- [ ] Alternate paths separated, not interleaved
- [ ] Ends with a verified artifact and ranked next steps
- [ ] Guide survives a cold run by someone unfamiliar with the product
