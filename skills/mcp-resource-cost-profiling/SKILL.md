---
name: mcp-resource-cost-profiling
description: Equips the advisor to flag expensive calls — huge payloads returned into context, chatty polling, token-bloated results, missing pagination or limits.
---

# MCP Resource Cost Profiling

Tool results re-enter the model context and are paid for again on every subsequent token. This discipline covers profiling each call's expected context cost before it fires and flagging the ones that flood the window. The classic offenders are unbounded enumerations, full-detail reads where a summary would answer, and chatty polling that one blocking wait would replace.

## Watch for
- Full-file, full-collection, or full-log reads when `limit`/`offset`/`top`/page parameters exist but are left unset
- MCP results returning very large payloads inline: entire tables, all issues, recursive trees with no `node_limit`
- Chatty polling: repeated status calls with `wait:false` where a single `wait:true` call would have blocked to completion
- Client-side filtering: fetching every item and then filtering in-model instead of using server-side query/filter parameters
- The same large, immutable resource fetched multiple times in one session
- Verbose detail tiers (`detail:"full"`, full message bodies) when abstract/overview/ids would have answered the question
- Unbounded recursion: `recursive:true`, deep tree walks, or list-everything calls with no depth or count cap
- Duplicate large payloads across subagents — each child re-fetches what the parent already holds in context

## Best practices
- Always set explicit bounds: `limit`, `top`, `node_limit`, `max_tokens`, page size — default to the smallest plausible value
- Filter server-side: query strings, include patterns, date ranges, field selection, `min_score` thresholds
- Start at the cheapest detail tier that could answer; escalate to fuller detail only when the cheap tier proves insufficient
- Use blocking waits or subscriptions instead of polling; if polling is unavoidable, back off exponentially
- Stream large artifacts to files and page through them rather than inlining megabytes into context
- Estimate before calling: if the expected result exceeds a few thousand tokens, narrow the request first
- Fetch once, share many: write expensive results to the workspace so subagents read the copy instead of re-fetching

## Quick checklist
- [ ] Any call with available limit parameters left unset?
- [ ] Any result visibly truncated or >~5k tokens pulled inline?
- [ ] Any polling sequence replaceable by one blocking wait?
- [ ] Could filtering have happened server-side instead of in-model?
- [ ] Any large resource fetched more than once?
- [ ] Is the detail tier the minimum sufficient for the question?
- [ ] Any recursive or unbounded enumeration?
