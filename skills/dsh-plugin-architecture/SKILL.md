---
name: dsh-plugin-architecture
description: Equips the advisor to detect structural violations of the DSH plugin model — blurred host/plugin boundaries, unsafe bundle loading, and broken activation flow.
---

# DSH Plugin Architecture Review

DSH plugins run inside a host process with a strict boundary: the host owns lifecycle, settings, RPC channels, and tool sandboxes; the plugin only receives what it is handed at activation. Reviewing architecture means verifying that a plugin never reaches around that boundary and that its structure survives being loaded, unloaded, and reloaded by the host.

## Watch for
- Plugin code importing host-internal modules or deep package paths instead of the public activation API.
- Module-level side effects (timers, listeners, file writes) that run at import time rather than inside `activate()`.
- Global mutable singletons that survive `deactivate()` and leak state across reloads.
- Client bundles assuming host-only APIs (fs, child_process, node builtins) are available in the browser-side runtime.
- RPC handlers registered outside the activation context so they cannot be disposed with the plugin.
- Plugins reading other plugins' settings files or state directories directly instead of going through host-provided scopes.
- Circular startup dependencies where plugin A waits on plugin B's export at load time.
- Bundle entry points that do heavy synchronous work and block the host's activation loop.

## Best practices
- Keep one narrow entry point: export `activate(ctx)` / `deactivate()` and do everything through the `ctx` handle.
- Treat the activation context as the only legitimate source of host services; wrap it behind a thin internal interface.
- Separate host bundle (privileged, Node) from client bundle (UI, sandboxed) and never share imports that drag Node APIs into the client.
- Make all registration (tools, RPC handlers, UI panels) return a disposer, and collect disposers for `deactivate()`.
- Defer expensive work until first use; activation should be fast and nearly side-effect free.
- Version-pin against the host API surface and fail loudly on an incompatible host version instead of limping along.
- Keep plugin state under the host-assigned state directory, never in the plugin's own install folder.
- Document the plugin's boundary in the README: what it registers, what permissions it needs, what it persists.

## Quick checklist
- [ ] All host interaction goes through the activation context, no deep imports.
- [ ] No side effects at module import time.
- [ ] Every registered handler/tool/listener has a matching disposal path.
- [ ] Client bundle contains no Node-only APIs.
- [ ] Plugin reload (deactivate + activate) leaves no leaked timers or listeners.
- [ ] State is stored in the host-provided scope, not the install directory.
- [ ] Host version compatibility is declared and checked.
- [ ] Activation completes quickly and is safe to run twice.
