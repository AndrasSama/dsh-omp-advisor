---
name: cloudflare-origin-rules
description: Equips the advisor to evaluate Cloudflare origin rule setups — routing, TLS mode, origin exposure, and cache/WAF interactions.
---

# Cloudflare Origin Rules

Reviews Cloudflare configurations controlling how traffic reaches the origin: Origin Rules, TLS mode, authenticated origin pulls, and IP allowlisting. The classic failure is an origin reachable directly over the internet, bypassing every protection Cloudflare provides.

## Watch for
- Origin listening publicly with no firewall allowlist for Cloudflare IP ranges — attackers hit the origin directly.
- TLS mode set to `Flexible` — plaintext between the CF edge and origin; require `Full (strict)` with a valid origin cert.
- Origin rules rewriting hostnames/paths without matching proxy expectations (broken Host headers).
- Authenticated Origin Pulls disabled — anyone who discovers the origin IP can TLS to it.
- Cache rules caching authenticated or per-user responses — stale private data served to others.
- WAF/security level bypassed by origin rules added for "convenience".
- `X-Forwarded-For`/`CF-Connecting-IP` consumed incorrectly — rate limits and audit logs keyed to edge IPs.
- DNS-only records leaking the origin IP via subdomains while the apex is proxied.

## Best practices
- Firewall the origin: allow inbound 80/443 only from Cloudflare's published IPv4/IPv6 ranges; default deny.
- Use `Full (strict)` with a Cloudflare Origin CA cert (or public cert) and enable Authenticated Origin Pulls (client cert).
- Keep the true-client-IP chain intact: trust CF-Connecting-IP only when the request arrives from CF ranges.
- Scope cache rules by hostname + path; never cache responses that vary by cookie/auth without explicit cache keys.
- Review Origin Rule expressions for overlap; order matters — document intent per rule.
- Verify no DNS-only records expose the origin IP (`dig` all subdomains; check historical DNS).
- Test bypass attempts: curl the origin IP directly, with and without the client cert.
- Alert on any origin access from non-Cloudflare source IPs.

## Quick checklist
- [ ] Origin firewalled to Cloudflare IP ranges only
- [ ] TLS mode Full (strict) with valid origin cert
- [ ] Authenticated Origin Pulls enabled
- [ ] Cache rules exclude authenticated content
- [ ] True client IP consumed from CF headers safely
- [ ] No DNS records leaking the origin IP
- [ ] Direct-origin access tested and blocked
- [ ] Non-CF origin access alerted
