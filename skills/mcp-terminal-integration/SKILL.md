---
name: mcp-terminal-integration
description: Equips the advisor to evaluate MCP server integrations for transport correctness, tool permission scoping, process lifecycle, and injection risk through tool output.
---

# MCP Terminal Integration

Reviews Model Context Protocol wiring — stdio/SSE transports, JSON-RPC 2.0 handshake, tool schemas — between an agent host and local MCP servers. Integration failures are usually lifecycle bugs (zombie processes, missing timeouts) or unsafe trust of tool arguments and results.

## Watch for
- MCP servers spawned without process-group management — orphaned children survive host restarts.
- No timeout on tool invocations; a hung stdio server blocks the agent indefinitely.
- Tool arguments interpolated into shell strings (`sh -c "run ${args.path}"`) — command injection.
- Secrets passed as CLI arguments (visible in `ps`) instead of environment variables or files.
- stdio server stderr discarded — protocol logs and errors vanish, making failures undebuggable.
- Tool schemas without input validation (`additionalProperties` unchecked), letting malformed args reach handlers.
- Tool output treated as trusted instructions — indirect prompt injection via file/web tool results.
- Version drift: client and server on different MCP protocol revisions without capability negotiation checks.

## Best practices
- Spawn stdio servers in their own process group; kill the group on shutdown; reap children to avoid zombies.
- Wrap every tool call in a timeout (default 30–60 s; longer only for declared long-running tools).
- Validate tool inputs against the declared JSON Schema before dispatch; pass argv arrays, never shell strings.
- Deliver credentials via env vars or mounted secret files (0600); scrub them from logs.
- Capture stderr separately per server, tagged with the server name; keep stdout pure JSON-RPC.
- Negotiate capabilities at `initialize`; fail loudly when a required feature is unsupported.
- Sandbox high-risk tools (filesystem write, shell exec) with path allowlists; scrutinize any tool requesting broad exec.
- Health-check long-lived SSE connections with periodic pings; reconnect with backoff.

## Quick checklist
- [ ] Child processes group-managed and reaped
- [ ] Every tool call has a timeout
- [ ] Tool args never reach a shell via string interpolation
- [ ] Secrets flow via env/files, not argv
- [ ] stderr captured and tagged per server
- [ ] Inputs validated against schema before dispatch
- [ ] Tool output treated as data, not instructions
- [ ] SSE reconnect logic with backoff present
