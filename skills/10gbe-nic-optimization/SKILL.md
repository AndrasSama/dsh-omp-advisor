---
name: 10gbe-nic-optimization
description: Equips the advisor to evaluate 10GbE NIC setup — ring buffers, offloads, RSS/IRQ steering, MTU consistency, and PCIe bottlenecks.
---

# 10GbE NIC Optimization

Reviews 10-gigabit NIC configuration on Linux hosts: offload flags, queue/IRQ steering, ring buffers, and physical-layer sanity. Single-stream underperformance is usually MTU or PCIe; multi-stream plateaus are usually IRQ/RSS.

## Watch for
- LRO (large receive offload) left enabled on routing/forwarding hosts — it corrupts forwarded segments; disable unless endpoint-only.
- MTU 9000 set on the NIC but not on the switch/peer — silent fragmentation or black holes.
- All NIC IRQs on core 0 (default) — single-core softirq saturation well below line rate.
- Ring buffers at default small sizes while `rx_missed_errors`/`rx_dropped` climb under bursts.
- NIC seated in a x1/x4 PCIe slot or running with aggressive ASPM power saving — can't reach line rate.
- Flow control (pause frames) enabled asymmetrically — head-of-line stalls across the switch.
- Vendor driver knobs (mlx5, ixgbe, i40e) left at defaults where known tuning exists.
- Tuning blind: `ethtool -S` error counters and interface drops never checked.

## Best practices
- Baseline with `iperf3` (single + parallel streams) and `ethtool -S` error counters before touching anything.
- Verify link negotiation (`ethtool eth0` shows 10000base*/Full) and PCIe width (`lspci -vv | grep LnkSta`).
- Spread RSS queues (`ethtool -L eth0 combined N`, N ≈ networking cores); pin IRQs via `/proc/irq/*/smp_affinity` and stop irqbalance for those IRQs.
- Raise ring buffers (`ethtool -G eth0 rx 4096 tx 4096`) when drops appear; re-check error counters after.
- Offloads: keep TSO/GRO on; disable LRO on forwarding hosts; verify state with `ethtool -k`.
- MTU 9000 only end-to-end (NIC, switch, peer, tunnel overhead considered); verify with `ping -M do -s 8972`.
- Disable pause frames unless the fabric is tuned for them; choose ECN/PFC deliberately in lossless setups.
- Re-run iperf3 after each change and keep a change log.

## Quick checklist
- [ ] Link at 10G full duplex, PCIe width adequate
- [ ] LRO state matches host role (off if forwarding)
- [ ] RSS queues spread and IRQs pinned
- [ ] Ring buffers sized against observed drops
- [ ] MTU consistent end-to-end and ping-verified
- [ ] Flow control symmetric or disabled
- [ ] ethtool -S error counters clean
- [ ] iperf3 before/after recorded
