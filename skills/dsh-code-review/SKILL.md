---
name: dsh-code-review
description: Equips the advisor to review diffs against DSH host-integration rules — API misuse, backward-compatibility breaks, and boundary violations introduced by a change.
---

# DSH Code Review Gate

Reviewing a DSH diff is not generic code review: the change must respect the host/plugin contract, keep existing integrations working, and avoid misusing host APIs. Reviewers walk the diff asking three questions — does it break the boundary, does it break existing callers, and does it use host APIs the way they are documented.

## Watch for
- Diffs that change a public host API signature without a compatibility shim or version bump.
- New code calling host APIs with arguments or ordering that differ from the documented contract.
- Removal or rename of an exported symbol other plugins may import.
- Changes to an RPC message shape that old clients or old hosts would misparse.
- A diff that widens a plugin's permissions or scopes beyond what the feature needs.
- Backward-incompatible settings/schema changes with no migration.
- Host-internal imports added where a public API already exists.
- Edits that silently change default behavior existing integrations rely on.

## Best practices
- Read the diff against the host API docs, not just for internal consistency.
- For any public signature change, require a deprecation path or a clear version gate.
- Treat removed/renamed exports as breaking; demand a search for downstream importers.
- Keep RPC and persisted shapes backward compatible, or add explicit versioning and migration.
- Verify the change stays within the plugin's declared capability surface.
- Prefer additive changes (new optional fields, new methods) over mutating existing ones.
- Check that default behavior changes are called out and intentional, not incidental.
- Confirm the diff updates tests and any host-integration docs it invalidates.

## Quick checklist
- [ ] No undocumented host API misuse introduced.
- [ ] Public signature changes have a compatibility or versioning plan.
- [ ] Removed/renamed exports checked for downstream importers.
- [ ] RPC and persisted shapes stay backward compatible or are versioned.
- [ ] Capability/permission surface is not widened unnecessarily.
- [ ] Settings/schema changes include migration.
- [ ] Default behavior changes are explicit and intentional.
- [ ] Tests and integration docs updated with the change.
