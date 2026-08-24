---
name: tool-call-redundancy-audit
description: Equips the advisor to detect duplicate and repeated tool calls — re-reading unchanged files, re-running identical searches or commands — and advise deduplication or caching.
---

# Tool Call Redundancy Audit

Every tool call costs tokens, latency, and possibly side effects, and the transcript makes prior results reusable. This discipline covers spotting calls whose answer is already in context — or deterministically will be — and pushing the agent to cite cached results instead of re-spending them. Redundant calls add nothing to the agent's information state; they are pure waste and often a symptom of the agent not trusting its own transcript.

## Watch for
- Identical tool+args signatures repeated within one turn (e.g. the same `read` of the same path/offset twice with no intervening `write`/`edit`)
- Re-reading a file whose last read result is still in context and which no intervening call has modified
- Re-running the same `grep`/`glob`/search pattern after results already returned and the tree has not changed
- Re-running the same bash command expecting different output with no state change between attempts
- Status polling that re-fires `job_output`/status calls with `wait:false` in a tight loop instead of one `wait:true`
- "Just in case" verification reads immediately after a successful write that already echoed the change
- Repeated deterministic MCP calls (same query, same filters) whose server-side state cannot have changed between calls
- The same large resource re-fetched by multiple subagents instead of fetched once and shared via the workspace

## Best practices
- Treat the transcript as a result cache: before any call, check whether an earlier call with equivalent args already answered the question
- Re-read only after mutation: a re-read is legitimate only if a `write`/`edit`/shell command touched the target since the last read — verify the intervening mutation exists
- Page instead of re-reading: use `offset`/`limit` to fetch a missing slice rather than pulling the whole file again
- Re-run only when inputs changed: a retry is justified by different args, different state, or a transient error — never by doubt alone
- Batch N single-target reads into one multi-target call where the tool supports it (e.g. batch URI reads)
- Share expensive deterministic results across subagents through the workspace: fetch once, write to file, read many times
- Quantify the waste when advising: count duplicate calls and estimate their token cost so the watched agent can prioritize the fix

## Quick checklist
- [ ] Same tool+args appearing 2+ times in one turn?
- [ ] Any file re-read with no intervening write/edit/shell mutation?
- [ ] Any identical search/glob/grep re-run after results already returned?
- [ ] Any polling loop replaceable by a single blocking wait?
- [ ] Any deterministic MCP call repeated with unchanged inputs?
- [ ] Could the repeated call be replaced by citing an in-context result?
- [ ] Is the redundancy systemic (a pattern across turns) or a one-off slip?
