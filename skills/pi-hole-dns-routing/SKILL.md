---
name: pi-hole-dns-routing
description: Equips the advisor to evaluate Pi-hole DNS setups — upstream recursion, conditional forwarding, local resolution, and leak/loop pitfalls.
---

# Pi-hole DNS Routing

Reviews Pi-hole deployments as network DNS: upstream choice, local domain resolution, DHCP interplay, and DoH handling. Misconfigurations leak queries around the filter, break local name resolution, or create forwarding loops.

## Watch for
- Conditional forwarding for local domains missing — RFC1918 reverse lookups forwarded upstream (leak plus latency).
- Upstream set to the same resolver the router also uses while the router points at Pi-hole — potential loop.
- Devices bypassing Pi-hole (hardcoded 8.8.8.8, per-app DoT/DoH) — filter coverage gaps.
- Gravity updates failing silently — stale blocklists for weeks.
- CNAME-cloaked ad domains unblocked because only the original domain is on the list.
- Pi-hole DHCP enabled while the router's DHCP is still active — duplicate leases.
- DNSSEC validation disabled, or upstreams that don't validate while coverage is claimed.
- A single Pi-hole with no fallback: one reboot is a whole-network DNS outage.

## Best practices
- Run a local recursive resolver (Unbound) as upstream, or curated DoH via cloudflared; never forward private zones upstream.
- Configure local DNS records plus conditional forwarding for every private domain and reverse zone.
- Enforce Pi-hole as the only resolver: router DHCP hands out the Pi-hole IP; block outbound 53 from non-Pi-hole hosts.
- Monitor gravity update success; alert when the last update is older than ~48 h.
- Use CNAME-aware blocking and maintain a curated allowlist reviewed periodically.
- DHCP: exactly one server; if Pi-hole serves DHCP, disable the router's and document lease ranges.
- Run a secondary Pi-hole (or fallback resolver) and advertise both via DHCP.
- Verify from clients with `dig`: local names, blocked domains, DNSSEC-signed zones.

## Quick checklist
- [ ] Local/reverse zones resolve without upstream forwarding
- [ ] No forwarding loops with the router resolver
- [ ] Outbound 53 restricted to Pi-hole
- [ ] Gravity update age monitored
- [ ] CNAME cloaking handled
- [ ] Exactly one DHCP server active
- [ ] Fallback resolver exists
- [ ] Client-side dig verification done
