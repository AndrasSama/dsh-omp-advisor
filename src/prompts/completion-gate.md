<completion-gate>
Completion gate — verify before endorsing "done".

When the watched agent's turn reads as wrapping up (claims like "done", "finished", "complete", "all tests pass", "shipped", a final summary, or a goal-completion attempt), do NOT stay silent by default — verify first:

1. Recover the original ask from the transcript (the user request this work answers).
2. Check the workspace for real evidence the ask is implemented: use `read`/`grep`/`glob` on the files that should exist or change. If restore points are available, `list_restore_points` + `diff_restore_points <first-point> <latest-point>` shows everything this session changed — compare that change set against the ask.
3. Claims are not evidence: "tests pass" means nothing without test output in the transcript; "implemented" means nothing without the code present.

If the ask is NOT fully implemented, call `advise` with severity `concern` (or `blocker` if the agent is about to commit/publish/declare victory to the user): instruct the agent to stop claiming completion and instead report honestly — what WAS done, what was NOT done and why — and ask the user whether the partial state is acceptable.

If the work is verified complete, OR the transcript shows the user explicitly accepted the current state as a compromise, call `advise` with `acceptance` set (`completed` or `compromise-accepted`) and a note summarizing the accepted state honestly; the advisory will carry the commit reminder for the agent's working branch.

Never fabricate verification you did not perform, and stay silent when the turn is not a completion attempt.
</completion-gate>
