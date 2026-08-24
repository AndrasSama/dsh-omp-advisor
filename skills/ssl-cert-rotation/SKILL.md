---
name: ssl-cert-rotation
description: Equips the advisor to evaluate certificate lifecycle automation — challenge type, renewal hooks, deploy reload, expiry monitoring, and chain completeness.
---

# SSL Cert Rotation

Reviews TLS certificate lifecycle: ACME issuance, renewal automation, deployment hooks, and monitoring. Rotation failures stay silent until expiry day; the review question is whether every link in issue → deploy → reload → verify is automated and observed.

## Watch for
- Certbot renewal cron without a `--deploy-hook` — new cert issued but services keep serving the old one until a manual restart.
- Wildcard certs attempted with HTTP-01 (impossible — wildcards require DNS-01) — renewal fails every cycle.
- DNS-01 provider credentials hardcoded in world-readable files.
- No expiry monitoring: reliance on "certbot handles it" with no alerts.
- Incomplete chain served (leaf without intermediate) — works in browsers, breaks CLI/Java/older clients.
- Renewal only ever tested against production rate limits — lockout after too many failed attempts.
- Cert paths hardcoded across N services; one renewal updates only some consumers.
- HSTS enabled with short-lived certs and no rollback plan — an expired cert bricks clients.

## Best practices
- Automate end-to-end: ACME client + systemd timer/cron + deploy hook that reloads exactly the services consuming the cert.
- Use DNS-01 for wildcards with scoped credentials (0600, ideally short-lived); HTTP-01 for single hostnames.
- Verify post-deploy: scripted `openssl s_client -connect host:443 -servername host` checking dates and the full chain, run inside the deploy hook.
- Monitor expiry centrally (prometheus blackbox `probe_ssl_earliest_cert_expiry`) with alerts at 14 and 7 days.
- Test renewals against staging (`--staging`) first; run `certbot renew --dry-run` on a schedule.
- Centralize cert paths (one canonical location, symlinks) so every consumer sees the rotation.
- Respect Let's Encrypt rate limits (~50 certs/week per registered domain); consolidate with SAN certs.
- Document an emergency re-issue runbook including DNS propagation time for DNS-01.

## Quick checklist
- [ ] Deploy hook reloads every consuming service
- [ ] Challenge type matches cert type (DNS-01 for wildcards)
- [ ] Provider credentials scoped and protected
- [ ] Expiry monitored with 14/7-day alerts
- [ ] Chain completeness verified programmatically
- [ ] Staging dry-runs scheduled
- [ ] Canonical cert paths shared by consumers
- [ ] Emergency re-issue runbook exists
