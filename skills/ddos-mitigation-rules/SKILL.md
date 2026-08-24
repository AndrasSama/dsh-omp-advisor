---
name: ddos-mitigation-rules
description: Equips the advisor to evaluate DDoS defenses — rate limiting, conntrack/SYN handling, upstream filtering, and the line between mitigation and self-DoS.
---

# DDoS Mitigation Rules

Reviews layered DDoS defense: edge filtering, host-level rate limiting, and protocol-level protections. Two failure modes to audit: rules too weak (the host absorbs the attack) and rules too blunt (legitimate traffic blocked — a self-DoS).

## Watch for
- Per-IP rate limits set without baseline traffic data — flash crowds get blocked, or limits sit too high to matter.
- Blanket UDP drops or ICMP blocks that break path-MTU discovery and legitimate services.
- fail2ban on high-cardinality logs without maxretry tuning — banning CDN/proxy IPs blocks thousands of users.
- SYN cookies disabled on exposed services; conntrack table exhausted before any limit kicks in.
- The host running open amplifiers (open DNS recursion, NTP monlist, UDP memcached) — it is the attack vector against others.
- Mitigation only at the origin with no upstream/edge layer (Cloudflare, ISP blackhole) for volumetric attacks.
- No logging before drop — attacks unattributable and false positives undebuggable.
- Blackhole/null routes applied without automatic expiry — a manual blackhole becomes a permanent outage.

## Best practices
- Baseline first: normal pps/bps and connection rates per service; set thresholds as multiples with headroom.
- Layer defenses: volumetric absorbed upstream (anycast/edge), L7 rate limits at the proxy, host-level (nftables `limit`, conntrack caps) as backstop.
- Rate-limit by real client identity (CF-Connecting-IP behind proxies), not edge IP; allowlist CDN ranges at the firewall.
- Enable SYN cookies (`tcp_syncookies=1`), size conntrack, and drop invalid states early.
- Audit amplifier potential: close open resolvers, disable monlist, bind memcached to TCP only.
- Log-then-drop with rate-limited logging (avoid log-flood self-DoS); feed crowdsec/fail2ban with tuned ban rules.
- Automate blackholes with expiry and alerting; document escalation to ISP/upstream.
- Run game days: simulate L7 floods on staging and verify limits, alerts, and rollback.

## Quick checklist
- [ ] Thresholds derived from measured baselines
- [ ] Volumetric defense upstream of the origin
- [ ] Rate limits keyed on real client IP
- [ ] SYN cookies and conntrack caps configured
- [ ] Host audited for amplifier potential
- [ ] Drops logged with rate limiting
- [ ] Blackholes auto-expire
- [ ] Mitigation drill performed
