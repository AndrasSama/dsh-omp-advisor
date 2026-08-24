---
name: sandbox-escape-prevention
description: Equips the advisor to detect sandbox-escape vectors — path traversal, command injection, env leakage, and missing permission-boundary checks in tool code.
---

# Sandbox Escape Prevention Review

DSH tools run inside a sandbox that constrains file access, commands, and environment visibility. Tool code is the wall: any path built from untrusted input, any shell string interpolated from arguments, any env var forwarded without filtering is a potential escape. Reviewers must assume every tool argument is adversarial.

## Watch for
- File paths built by concatenating user input without resolving and re-checking against the allowed root.
- `..` segments, absolute paths, or symlinked paths accepted and passed straight to fs operations.
- Shell commands assembled by string interpolation of tool arguments (command injection).
- Use of `child_process` with `shell: true` on any input-derived string.
- Environment variables (tokens, keys, PATH) forwarded into subprocesses or tool output unfiltered.
- Permission checks done on one path string but the operation performed on a differently-resolved path (TOCTOU).
- Tool output that echoes absolute host paths or internal config back to the model/user.
- Missing re-validation after a path or command passes through a helper that "already checked it".

## Best practices
- Resolve every input-derived path with `path.resolve`, then assert it starts with the allowed root before any fs call.
- Reject or neutralize `..`, absolute paths, and symlinks that point outside the sandbox root.
- Build commands as argv arrays passed to spawn without `shell: true`; never interpolate into a shell string.
- Allowlist the exact env vars a subprocess may see; strip everything else.
- Perform the permission check on the same final path object used by the operation, immediately before the call.
- Treat tool output as public: scrub absolute paths, secrets, and internal identifiers before returning.
- Centralize boundary checks in one helper and route all fs/exec calls through it.
- Add negative tests: traversal attempts, shell metacharacters, and env probes must all be rejected.

## Quick checklist
- [ ] All input-derived paths are resolved and root-checked before use.
- [ ] `..`, absolute, and symlink escapes are rejected.
- [ ] No shell-string interpolation of tool arguments; argv arrays only.
- [ ] `shell: true` is absent or provably input-free.
- [ ] Subprocess env is allowlisted, not inherited wholesale.
- [ ] Permission check and operation use the same resolved path.
- [ ] Tool output is scrubbed of host paths and secrets.
- [ ] Negative escape tests exist and pass.
