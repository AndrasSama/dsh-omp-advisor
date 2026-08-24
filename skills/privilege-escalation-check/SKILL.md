---
name: privilege-escalation-check
description: Equips the advisor to detect vertical and horizontal privilege escalation paths in authz logic, RBAC, and tool/process permissions.
---

# Privilege Escalation Checks

Privilege escalation review asks one question of every code path: can an actor reach a capability their role does not grant?
That covers vertical escalation (user → admin), horizontal (user A → user B's data), and the agentic variant where a low-trust input steers a high-privilege process — check the enforcement point, not the intent, because authorization that only lives in the UI is not authorization.

## Watch for
- IDOR: object ids taken from the request and used without an ownership/role check at the data layer
- Client-side-only authorization: buttons hidden in the UI while the API endpoint stays open
- Role checks performed once at login, with stale claims trusted for the whole session lifetime
- Mass assignment: request bodies bound to models that include role/isAdmin/owner fields
- Confused deputy: a privileged service performs actions on behalf of untrusted input without re-checking the requester
- Agent/tool paths where a low-privilege user's content is executed by a high-privilege agent identity
- Path traversal or route shadowing that reaches admin endpoints (URL-encoded, trailing-slash, or case variants)

## Best practices
- Enforce authorization server-side at every endpoint and every data access, ideally in one middleware/policy layer
- Deny by default; require each handler to declare the role/scope it needs
- Re-verify ownership on every object access: query scoped by the authenticated principal, not by client-supplied ids alone
- Whitelist assignable fields; never bind role or ownership fields from user input
- For agents: run tools under the requesting user's identity or an explicitly downscoped service identity, never blanket root
- Normalize paths and enforce admin route prefixes at the router level
- Write escalation tests: for each privileged endpoint, a test asserts a lower role gets 403

## Quick checklist
- [ ] Every endpoint declares and enforces server-side authz
- [ ] Object access scoped by authenticated owner, not client id alone
- [ ] No role/owner fields bindable from request bodies
- [ ] Claims re-checked or short-lived, not cached forever
- [ ] Agent actions run under least-privilege identity
- [ ] Admin routes protected at router level with path normalization
- [ ] Negative tests exist: lower role → 403 on each privileged route
