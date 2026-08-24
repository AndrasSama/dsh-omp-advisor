---
name: capability-manifestos
description: Equips the advisor to detect dishonest or over-broad capability declarations — undeclared permissions, privilege creep, and manifests that understate what the plugin actually does.
---

# Capability Manifestos Review

A DSH plugin's capability manifest is its permission promise to the host and the user: which scopes it reads, which tools it registers, which privileged operations it performs. The manifest must match reality exactly. Reviewers verify that declared capabilities are minimal, honest, and match the code's actual behavior.

## Watch for
- Code that uses a privileged host API (fs, network, shell) not declared anywhere in the manifest.
- Manifest requesting broad scopes when the code only touches a narrow slice.
- Optional capabilities declared as required, or required ones omitted.
- Permissions requested "just in case" with no code path that uses them.
- A manifest that lists capabilities the plugin inherits from a dependency rather than uses directly.
- Capability strings that are vague or invented rather than drawn from the host's known capability set.
- Drift where code gained a new capability but the manifest was not updated in the same change.
- Missing user-facing explanation for any capability that touches private data.

## Best practices
- Declare the minimal set of capabilities the code actually exercises; remove anything unused.
- Treat the manifest as part of every diff that touches privileged code — update both together.
- Use the host's canonical capability identifiers; never invent or approximate them.
- Separate required from optional capabilities so the host can degrade gracefully.
- For each capability, be able to point at the exact code path that justifies it.
- Prefer narrow scopes (a specific directory, a named channel) over broad ones (all fs, all network).
- Document in the manifest or README what each sensitive capability is used for.
- Add a review/test step that diffs declared capabilities against statically detected API usage.

## Quick checklist
- [ ] Every privileged API used in code is declared in the manifest.
- [ ] Every declared capability has a real code path that uses it.
- [ ] Scopes are as narrow as the code allows.
- [ ] Required vs optional capabilities are distinguished.
- [ ] Capability ids match the host's canonical set.
- [ ] Manifest and code changed together in any privilege-touching diff.
- [ ] Sensitive capabilities carry a user-facing justification.
- [ ] A check exists comparing declared vs actually-used capabilities.
