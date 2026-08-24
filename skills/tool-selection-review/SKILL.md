---
name: tool-selection-review
description: Equips the advisor to judge whether the right tool was chosen for each job — grep vs read vs glob, bash vs dedicated tools — and flag misuse or missed specialized tools.
---

# Tool Selection Review

A tool catalog is a menu with prices: each tool differs in cost, precision, failure mode, and policy surface. This discipline covers checking that each step used the narrowest, most precise tool available, and flagging shell improvisation where a dedicated tool would have been cheaper, structured, and policy-aware. Wrong-tool use wastes tokens and can silently bypass the sandbox and approval guardrails that dedicated tools enforce.

## Watch for
- `bash cat/head/tail` used to inspect text files instead of the `read` tool (loses line numbers, paging, and observation-policy awareness)
- `bash find`/`ls -R` for file discovery instead of `glob`; `bash grep`/`rg` instead of the `grep` tool
- Reading an entire file to locate one symbol when a `grep` pattern would have returned the exact line numbers first
- Using `glob` to search file content (it matches paths only) or `grep` to discover filenames
- `write`-ing a whole file to change three lines instead of a surgical `edit` with a unique `old_string`
- Ignoring a domain or MCP tool that wraps multi-step logic (search, batch read, structured query) which the agent re-implements in shell
- Wrong granularity: pulling a 10k-line file whole instead of localizing with grep then paging with `offset`/`limit`
- Choosing raw shell for a mutation that the file tools would have routed through approval — a guardrail bypass, not just a style issue

## Best practices
- Match the tool to the question: discover paths → `glob`; search content → `grep`; inspect → `read`; mutate → `edit`/`write`; only then consider bash
- Scan the available tool catalog — including MCP and domain tools — before improvising a shell pipeline
- Prefer dedicated tools over bash equivalents: they return structured results and honor sandbox/approval policy
- Localize then page: grep for the region of interest, then `read` only that window
- Use `edit` for targeted changes; reserve `write` for new files or complete rewrites of already-read files
- Escalate to bash only when no dedicated tool covers the need, and the reason should be visible in the call itself
- Prefer an MCP server's high-level operations over chains of its primitives — the server encodes the efficient path

## Quick checklist
- [ ] Any bash call duplicating a dedicated tool's function?
- [ ] Any whole-file read where grep would have localized the answer?
- [ ] Any glob/grep role confusion (paths vs content)?
- [ ] Any specialized tool available that matches the task but was skipped?
- [ ] Any `write` used where `edit` would have been surgical?
- [ ] Any paging/filtering parameters available but unused?
- [ ] Any shell call that appears to route around sandbox or approval policy?
