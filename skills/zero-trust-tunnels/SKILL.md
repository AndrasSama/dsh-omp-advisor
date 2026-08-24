---
name: zero-trust-tunnels
description: Equips the advisor to evaluate zero-trust tunnel setups (WireGuard/Tailscale/Cloudflare Tunnel) — identity scoping, ACLs, exposed-surface reduction, and key hygiene.
---

# Zero-Trust Tunnels

Reviews outbound-only tunnel architectures (Cloudflare Tunnel, Tailscale, WireGuard meshes) that replace inbound ports. The promise is "nothing listens publicly"; the review checks whether identity, ACLs, and key hygiene actually enforce least privilege — or merely moved the perimeter.

## Watch for
- Tunnels exposing admin UIs (router, NAS, Proxmox) to the entire tailnet/org instead of per-user ACLs.
- Cloudflare Tunnel ingress with a catch-all forwarding rule instead of a terminal `http_status:404` service.
- Subnet routers advertising whole LANs when only two hosts are needed — blast radius.
- Shared device/auth keys with no expiry or rotation; personal accounts owning infrastructure devices.
- MFA disabled on the control plane (Tailscale admin, Cloudflare Zero Trust dashboard) — one phished account owns the mesh.
- "Zero trust" bypassed by legacy port forwards left open alongside the tunnel.
- No egress segmentation: a compromised tunnel host can reach everything behind it.
- Device posture checks unused — unpatched personal devices granted the same access as managed hosts.

## Best practices
- Default deny: expose specific services to specific identities (user groups, service accounts) with explicit ingress/ACL rules.
- End cloudflared ingress with a catch-all 404; enumerate every public hostname and its backend.
- Scope subnet routers to minimum routes; document each advertised CIDR with an owner.
- Issue per-device keys with expiry and rotation; keep infra under a break-glass admin account with MFA and hardware keys.
- Enforce MFA + SSO on the control plane; require device posture / managed-device checks for sensitive routes.
- Decommission legacy port forwards when a tunnel replaces them; audit listeners periodically (`ss -tlnp`).
- Segment: separate networks for prod, homelab, and personal; route between them only through reviewed gates.
- Log access decisions and alert on anomalous auth (new device, unusual location, off-hours admin).

## Quick checklist
- [ ] Every exposure mapped to identity + ACL
- [ ] No catch-all ingress forwarding (terminal 404)
- [ ] Subnet routes minimized and owned
- [ ] Keys per-device, expiring, rotated
- [ ] Control-plane MFA + SSO enforced
- [ ] Legacy port forwards decommissioned
- [ ] Egress segmented by environment
- [ ] Access decisions logged and alerted
