---
name: network-segmentation-audit
description: Equips the advisor to review network designs for flat topologies, missing zone boundaries, and east-west paths that let one compromise reach everything.
---

# Network Segmentation Audit

Segmentation contains breaches: if one compromised host can reach the database, the build system, and every workstation, the perimeter is the only control left. Reviewers map zones and their allowed paths, verify default-deny between them, and check that the rules match the architecture on paper.

## Watch for
- Flat networks where any host can initiate connections to any other.
- Databases or internal services reachable from the general user VLAN.
- Firewall rules opened "temporarily" that outlived their change ticket.
- Broad any-to-any rules hiding inside otherwise tight rule sets.
- Jump/bastion hosts usable as unrestricted pivots into every zone.
- Build and CI infrastructure sharing a zone with production secrets.
- Segmentation defined only on paper, with no enforced rules in the actual path.
- Cloud security groups allowing 0.0.0.0/0 to administrative ports.

## Best practices
- Define zones by trust level (user, app, data, mgmt, CI) and document allowed flows between them.
- Default-deny between zones; every allowed path has an owner and a reason.
- Place databases and secret stores in their own zone, reachable only from app-tier services.
- Isolate build/CI from production; artifacts cross the boundary, not credentials.
- Restrict bastion access to named targets and log every session.
- Reconcile the documented architecture with live rules periodically — drift is the norm.
- In cloud, audit security groups and NACLs for wide CIDRs on sensitive ports.
- Test containment: from a simulated compromised host, enumerate reachable targets.

## Quick checklist
- [ ] Zones defined by trust level with documented allowed flows.
- [ ] Default-deny enforced between zones.
- [ ] Data tier reachable only from authorized app-tier services.
- [ ] CI/build separated from production and its secrets.
- [ ] No stale "temporary" firewall openings.
- [ ] Bastion access scoped to named targets and logged.
- [ ] Live rules reconciled with documented architecture.
- [ ] Containment verified from a simulated compromised host.
