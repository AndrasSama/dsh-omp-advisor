---
name: tool-loop-detection
description: Equips the advisor to detect ping-pong and infinite tool loops — same call/args recurring, A→B→A oscillation — and advise exit conditions.
---

# Tool Loop Detection

Agents run in tool-call loops, and loops without exit conditions are where budgets die. This discipline covers recognizing recurrence signatures — identical calls replaying, two states flip-flopping, polling that never terminates — and demanding explicit stop rules. A loop is only legitimate when each iteration can point to new information or changed state; otherwise it is a treadmill spending tokens to stay in place.

## Watch for
- The same call+args signature recurring 3+ times across turns with no intervening state change
- A→B→A oscillation: one edit fixes a test and the next edit reverts it; config added, removed, then added again
- Polling loops with no termination condition or backoff — status checks every few seconds against a job that takes minutes
- Re-entering the same subtask after each failure with only superficial rewording of the approach
- Continuation rounds (goal- or Ralph-style) that replay identical work each round because state was never persisted to the workspace
- Circular pipelines: tool A's output feeds tool B whose output feeds back into A unchanged
- "One more try" escalation: each iteration widens scope — bigger hammer, broader permissions — without any new evidence
- Loops the agent cannot count: no stated iteration number, no stated exit condition anywhere in its reasoning

## Best practices
- Demand an explicit exit condition before any loop starts: a max iteration count, a success predicate, or a changed-input requirement
- Require measurable progress per iteration: new information, changed state, or a narrowed hypothesis — state it or stop
- Cap retries at 2–3, then change strategy or escalate to the user; never repeat a failed iteration verbatim
- For waiting, use blocking waits with timeouts (`wait:true`) or exponential backoff instead of busy polling
- On detecting oscillation, stop editing and re-derive from a clean baseline: fresh read, `git status`, or last-known-good state
- Persist loop state to the workspace (notes, todo list) so continuation rounds resume instead of replaying
- Name the loop when advising: give the warning a concrete signature ("this exact call has now run 4 times with identical args")

## Quick checklist
- [ ] Any call+args signature appearing 3+ times?
- [ ] Any two-state oscillation (fix/break, add/remove)?
- [ ] Any polling without backoff or a termination condition?
- [ ] Can each iteration point to new information gained?
- [ ] Does every loop have a stated max-iteration cap?
- [ ] Did the agent recognize the loop itself?
- [ ] Was there an exit via escalation or strategy change?
