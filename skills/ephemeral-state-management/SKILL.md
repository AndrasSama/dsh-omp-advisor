---
name: ephemeral-state-management
description: Equips the advisor to verify that data declared ephemeral truly lives only in memory, is never persisted, and is reliably destroyed on completion, crash, or restart.
---

# Ephemeral State Management

"In-memory only" is a promise that code frequently breaks: caches, swap, crash dumps, and debug endpoints all quietly persist data that was supposed to vanish. This skill reviews ephemeral-processing designs for persistence leaks and cleanup discipline. It is an engineering review, not a compliance attestation.

## Watch for
- "Ephemeral" data written to disk via caches, temp files, session stores, or ORM write-behind.
- Sensitive values landing in swap because memory is not locked or the runtime swaps freely.
- Crash dumps, core files, and error reporters capturing in-memory secrets.
- Debug/admin endpoints exposing live in-memory state.
- No cleanup on failure paths: exceptions or kills leave state resident indefinitely.
- Long-lived singletons holding sensitive data far beyond the request that produced it.
- Serialization of ephemeral objects into logs, metrics, or message queues.
- Missing lifecycle definition: nobody can say when the state is supposed to die.

## Best practices
- Define an explicit lifecycle for each ephemeral datum: created where, used by whom, destroyed when.
- Keep sensitive buffers short-lived and zero them on release where the language allows.
- Disable or exclude persistence on sensitive paths: no disk caches, no serialized sessions, no write-behind.
- Configure crash handling to exclude sensitive memory or scrub dumps before retention.
- Use finally/defer patterns so cleanup runs on every path, including errors and cancellation.
- Scope state to the narrowest lifetime: request-scoped over process-scoped by default.
- Turn off or redact debug introspection for anything holding sensitive state.
- Test destruction: kill the process mid-operation and verify nothing sensitive survives on disk.

## Quick checklist
- [ ] Every ephemeral datum has a documented lifecycle.
- [ ] No disk writes on sensitive paths (cache, temp, session).
- [ ] Swap/core-dump exposure assessed and mitigated.
- [ ] Cleanup runs on success, error, and cancellation paths.
- [ ] State scoped to the narrowest lifetime feasible.
- [ ] Debug endpoints cannot expose sensitive state.
- [ ] No serialization of ephemeral data into logs/queues.
- [ ] Crash-kill test confirms nothing sensitive persists.
