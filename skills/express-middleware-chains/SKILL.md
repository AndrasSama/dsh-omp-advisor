---
name: express-middleware-chains
description: Equips the advisor to review Express middleware ordering, error-handling gaps, and async handler pitfalls that cause leaks, hangs, or uncaught crashes.
---

# Express Middleware Chains

Express middleware is order-dependent and unforgiving: a misplaced `next()`, an uncaught async throw, or a missing error handler turns a small bug into a hung request or a dead process. Reviewers walk the chain top to bottom, checking what runs before what and where errors finally land.

## Watch for
- Async handlers without a wrapper — thrown rejections never reach error middleware.
- Error-handling middleware (4-arg) registered before routes it should catch.
- Middleware calling `next()` after already sending a response (double-dispatch).
- Body parsers with no size limit (`express.json()` defaults are small; custom ones may not be).
- Auth/session middleware mounted after routes that need it.
- `next(err)` skipped in catch blocks — errors swallowed, requests hang.
- Route handlers mutating `req`/`res` in ways later middleware silently depends on.
- Catch-all `app.use` loggers or CORS placed after route definitions.

## Best practices
- Wrap async handlers (helper or express 5 native) so rejections hit error middleware.
- Order deliberately: security/helmet → parsers → auth → routes → 404 → error handler.
- Register the 4-arg error handler last; verify it logs and normalizes responses.
- Set explicit `limit` on body parsers to match real payload needs.
- Never call `next()` after `res.end`/`res.json`; return instead.
- Keep middleware pure-ish: document any `req` augmentation it performs.
- Mount CORS/helmet before routes; verify preflight responses in tests.
- Test the error path end to end: force a throw and assert the response shape.

## Quick checklist
- [ ] All async handlers route errors to error middleware.
- [ ] Middleware order verified: security → parse → auth → routes → errors.
- [ ] 4-arg error handler present, last, and tested.
- [ ] Body parser limits set explicitly.
- [ ] No `next()` after response sent.
- [ ] Auth/session mounted before protected routes.
- [ ] CORS/helmet mounted before routes, preflights tested.
- [ ] Forced-error test asserts the final response shape.
