---
name: state-persistence-apis
description: Equips the advisor to detect unsafe state persistence — non-atomic writes, missing schema migration, wrong settings scope, and brittle parsing of stored data.
---

# State Persistence APIs Review

DSH plugins persist settings and state through host-provided scopes and storage APIs. Persisted data outlives any single run and often outlives the plugin version that wrote it, so writes must be atomic and reads must tolerate older shapes. Reviewers check both the write path and the read path.

## Watch for
- Direct file writes to the state directory instead of the host's persistence API.
- Non-atomic writes (write-in-place) that can leave a corrupt file on crash.
- Settings stored in the wrong scope (global vs workspace vs session) for their meaning.
- Reads that assume the current schema and crash on older persisted shapes.
- Missing or ad-hoc schema migration when a stored field is renamed or retyped.
- Strict parsing that rejects an entire settings file because one unknown key appeared.
- Secrets written into plain settings files or synced scopes.
- No default fallback when a key is absent, causing undefined to propagate.

## Best practices
- Always persist through the host's settings/state API, never raw fs in the state dir.
- Write atomically: write to a temp file then rename, or use the host's atomic-write helper.
- Choose the narrowest correct scope for each setting (session < workspace < global).
- Read leniently: validate, apply defaults for missing keys, and ignore unknown keys rather than failing.
- Version persisted data and run explicit migration steps from old to current schema.
- Keep migrations idempotent and forward-only; never mutate history in place.
- Keep secrets out of persisted settings; reference secure storage instead.
- Add round-trip tests: write, read back, and read an older fixture through the migration path.

## Quick checklist
- [ ] Persistence goes through the host API, not raw file writes.
- [ ] Writes are atomic (temp + rename or host helper).
- [ ] Each setting lives in the correct scope.
- [ ] Reads tolerate missing and unknown keys with defaults.
- [ ] Persisted data carries a version and has a migration path.
- [ ] Migrations are idempotent and forward-only.
- [ ] No secrets stored in plain settings.
- [ ] Round-trip and old-fixture migration tests pass.
