---
name: tool-error-recovery-patterns
description: Equips the advisor to evaluate how the agent reacts to tool errors — blind retry storms, ignoring errors and plowing on, missing escalation — and recognize correct recovery shapes.
---

# Tool Error Recovery Patterns

Tool errors are signals with a class: validation, transient, permission, or logic. This discipline covers auditing the agent's reaction to each failure — whether it diagnosed, corrected, retried appropriately, or escalated. The two failure extremes are blind retry storms (same call, same args, same error) and silent plow-on (building on a failed step as if it had succeeded); both burn tokens and both hide the real problem from the user.

## Watch for
- Immediate identical retry after failure: same tool, same args, nothing changed in state or understanding
- Retry storms: 3+ attempts at the same failing call within one turn with no diagnosis between attempts
- Plowing on: subsequent steps that assume a failed step succeeded (building on a missing file, an empty query result, a partial write)
- Treating policy denials (`[sandbox: file access denied]`, approval-disabled rejections) as transient and retrying via a workaround
- Privilege escalation after denial: switching to a more dangerous tool or path to route around the block
- Misreading non-errors as errors: truncation notices, empty-but-valid results, exit code 1 from a grep with no match
- Correctable errors (stale id, wrong path, expired attempt token) retried without applying the correction the message named
- Persistent failures never surfaced to the user — the agent quietly abandons the subgoal or fabricates success

## Best practices
- Classify before acting: validation → fix args; transient → retry with a change; permission → escalate; logic → re-plan
- Diagnose first: read the actual error text; the attempted fix must correspond to what the message says
- Retry only transient failures, at most 2–3 times, with backoff or changed parameters — never the identical payload
- Policy denials are final: report them to the user verbatim; never route around a sandbox or approval decision
- Halt downstream work when a dependency step fails; re-plan from the actual state instead of the hoped-for state
- Escalate to the user after repeated failures or on ambiguous errors — a question is cheaper than a confident wrong guess
- Verify recovery with an independent check (read-back, status query), not just a non-error return code

## Quick checklist
- [ ] Any identical retry after failure with no argument or state change?
- [ ] 3+ retries of the same call within one turn?
- [ ] Any subsequent step assuming a failed step succeeded?
- [ ] Any sandbox/approval denial worked around rather than reported?
- [ ] Does the attempted fix correspond to the actual error message?
- [ ] Did persistent failures reach the user?
- [ ] Is the recovery strategy matched to the error class?
