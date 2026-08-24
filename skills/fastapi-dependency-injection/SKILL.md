---
name: fastapi-dependency-injection
description: Equips the advisor to review FastAPI Depends() graphs for correct scoping, testability, and hidden coupling between the request lifecycle and business logic.
---

# FastAPI Dependency Injection

FastAPI's `Depends()` graph is the backbone of request-scoped resource management: DB sessions, auth principals, and clients. A poorly designed graph leaks sessions, hides coupling behind globals, and makes tests impossible to isolate. Reviews should trace each dependency's lifecycle and its override story.

## Watch for
- DB sessions created at module import or as globals instead of per-request dependencies.
- `yield` dependencies missing cleanup (session not closed/rolled back on exception).
- Business logic importing `Request` directly or reading globals instead of receiving injected deps.
- Deep dependency chains where intermediate layers only forward arguments (DI theater).
- Dependencies doing heavy work (network calls) on every request with no caching.
- Auth dependencies that silently return `None` instead of raising 401/403.
- Tests that monkeypatch internals instead of using `app.dependency_overrides`.
- Sync blocking dependencies declared `async def`, stalling the event loop.

## Best practices
- Provide the DB session via a `yield` dependency that rolls back on error and always closes.
- Keep dependencies small and composable: one for auth, one for pagination, one for the session.
- Make every external collaborator injectable so tests can swap it via `app.dependency_overrides`.
- Raise `HTTPException` in auth dependencies; never return sentinel values.
- Use `Depends` caching deliberately; document when a dependency must re-run per request.
- Declare sync blocking deps as plain `def` so FastAPI runs them in the threadpool, not the event loop.
- Type dependencies precisely with `Annotated` aliases so contracts are visible at the route signature.
- Keep route handlers thin: parse via schema, delegate to a service layer receiving injected deps.

## Quick checklist
- [ ] DB sessions are request-scoped `yield` dependencies with guaranteed close.
- [ ] Exceptions inside the request roll the session back.
- [ ] No business logic reads globals or constructs its own clients.
- [ ] Every external dependency is overridable in tests via `dependency_overrides`.
- [ ] Auth dependencies raise, never return None/sentinels.
- [ ] Sync blocking code lives in `def` deps, not `async def`.
- [ ] Repeated dependency chains are factored into Annotated aliases.
- [ ] Route handlers stay thin and delegate to injected services.
