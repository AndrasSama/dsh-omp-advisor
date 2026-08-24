---
name: brute-force-mitigation
description: Equips the advisor to verify rate limiting, lockout, throttling, and credential-stuffing defenses on authentication endpoints.
---

# Brute-Force Mitigation

Brute-force review targets every endpoint that answers the question "is this credential correct?": login, password reset, OTP verification, API key validation, and invite/code redemption.
The bar is not "we have rate limiting somewhere" but "an attacker cannot try more than N guesses per target per window, and the legitimate user is not locked out instead."

## Watch for
- Auth endpoints with no rate limit, or limits applied per IP only (trivially bypassed via botnets or IPv6 rotation)
- No account-level throttling or progressive delay after repeated failures
- OTP/PIN verification accepting unlimited attempts (4–6 digit codes are brute-forceable in minutes without throttling)
- Response differences that oracle valid vs invalid usernames (different error text, status codes, or response times)
- Password reset and invite tokens short or predictable enough to enumerate
- CAPTCHA never triggered, or triggered only after the damage is done
- Per-instance rate-limit counters with no shared store, or limits bypassed via alternate endpoints (GraphQL, mobile API)

## Best practices
- Layer limits: per-IP plus per-account plus per-target, in a shared store (Redis) so they hold across instances
- Exponential backoff or temporary lockout after roughly 5–10 failures, with unlock via verified email or time expiry — and log every lockout
- Constant-time responses: same error message and similar latency for bad user vs bad password
- Add proof-of-work or CAPTCHA (Turnstile/hCaptcha) escalation after the first few failures, not as the only defense
- Make OTP codes ≥ 6 digits, single-use, expiry ≤ 10 minutes, hard attempt cap (e.g., 5) then re-issue
- Monitor and alert on credential-stuffing signatures: high failure rates with rotating IPs and valid-looking usernames
- Test the control: script N+1 attempts against the endpoint and confirm the block actually fires

## Quick checklist
- [ ] Every auth-verifying endpoint has per-IP and per-account limits
- [ ] Limits live in shared state, effective across instances
- [ ] Lockout/backoff triggers after bounded failures and is logged
- [ ] Identical error text and timing for bad user vs bad password
- [ ] OTP: ≥6 digits, single-use, attempt-capped
- [ ] CAPTCHA/PoW escalation present after initial failures
- [ ] N+1 attempt test confirms enforcement fires
