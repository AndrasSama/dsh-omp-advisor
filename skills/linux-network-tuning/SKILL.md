---
name: linux-network-tuning
description: Equips the advisor to evaluate sysctl and network tuning changes for correctness, measurability, and common conntrack/backlog pitfalls.
---

# Linux Network Tuning

Reviews kernel network tuning (sysctl, fd limits, queueing) on hosts under real load. Most tuning is cargo-culted: values copied from blog posts without measurement, or changes that trade one bottleneck for another.

## Watch for
- `nf_conntrack_max` raised without sizing memory (each entry costs hundreds of bytes; 1M entries ≈ 300 MB) or without asking why so many flows exist.
- `somaxconn`/`tcp_max_syn_backlog` raised while the application's listener backlog stays small — the minimum wins.
- `tcp_tw_reuse=1` applied to servers accepting inbound connections — it only affects outbound client ports; cargo cult.
- Buffer tuning (`rmem_max`/`wmem_max`) to multi-GB values on modest-RAM hosts — memory pressure.
- File-descriptor limits raised in sysctl but not in the systemd unit or PAM — the effective per-process limit is unchanged.
- Tuning without a baseline: no `ss -s`, `conntrack -C`, or `nstat -az` evidence before/after.
- IRQ affinity changes conflicting with a running `irqbalance` — settings silently overwritten.
- Jumbo frames (MTU 9000) set on one hop only — black-holed large packets along the path.

## Best practices
- Measure first: `ss -s` for socket states, `conntrack -C` for counts, `nstat -az` for drops/overflows; tune the actual bottleneck.
- Persist via `/etc/sysctl.d/*.conf`, apply with `sysctl --system`, and document the rationale per knob in comments.
- Conntrack: on NAT/router hosts size `nf_conntrack_max` ≈ peak concurrent flows × 2 and set `nf_conntrack_buckets`; otherwise consider NOTRACK for high-volume flows.
- Raise the listener backlog in the application (listen() backlog argument) together with `somaxconn`.
- Set `nofile` consistently (limits.conf or systemd `LimitNOFILE`) and verify via `/proc/<pid>/limits`.
- For NIC-bound workloads, pin IRQs to cores manually, stop irqbalance for those devices, and enable RPS/RFS for queue spread.
- Apply MTU changes end-to-end and verify with `ping -M do -s 8972`.
- Load-test before/after each change; keep rollback simple (remove the sysctl.d file).

## Quick checklist
- [ ] Baseline metrics captured before the change
- [ ] Each knob has a documented bottleneck rationale
- [ ] Conntrack sizing includes memory cost
- [ ] Backlog raised in kernel and application together
- [ ] fd limits verified effective per process
- [ ] Changes persisted via sysctl.d with comments
- [ ] IRQ affinity not clobbered by irqbalance
- [ ] MTU verified end-to-end
