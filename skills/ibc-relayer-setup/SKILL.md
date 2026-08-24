---
name: ibc-relayer-setup
description: Equips the advisor to evaluate IBC relayer configuration (Hermes) — trusting periods, channel handshakes, key management, and packet timeout hygiene.
---

# IBC Relayer Setup

Reviews Hermes (or similar) relayer deployments connecting appchains: chain entries, key management, client/channel creation, and packet relaying config. Misconfiguration shows up as stuck packets, expired clients, or relayers draining their wallets on fees.

## Watch for
- `trusting_period` set ≥ unbonding time — clients can be fooled by equivocation; it must be shorter (commonly ~⅔ of unbonding).
- Relayer keys holding unrestricted funds or reused across environments.
- Missing `gas_multiplier` headroom — relayer txs fail under fee spikes and packets time out.
- Packet timeouts (`timeout_height`/`timeout_timestamp`) too tight for the path's latency — chronic timeouts and refunds.
- No health monitoring: relayer down for hours with packets pending, unnoticed.
- Channel version strings not validated during handshake (ICS-20 transfer expects `ics20-1`).
- A single relayer process as a point of failure with no restart supervision or standby.
- Wallet auto-top-up disabled — silent stall when the relayer balance runs dry.

## Best practices
- Set trusting_period ≈ ⅔ of unbonding_time with refresh well before expiry; Hermes refreshes automatically when configured.
- Use dedicated relayer accounts per chain with funding alert thresholds; enable low-balance alarms.
- Configure `gas_multiplier` ~1.1–1.3 and a sane `max_gas` per tx; test under congested-fee conditions.
- Size packet timeouts for worst-case path latency plus margin (minutes, not seconds, for cross-chain transfers).
- Create clients/connections/channels with `hermes create` commands, reviewing ordering and version strings.
- Monitor pending packets per channel, client expiry countdowns, tx success rate, and wallet balances.
- Run under supervision (systemd) with a documented standby procedure; test failover.
- Test the full path on testnet: transfer, timeout, refund, and misbehaviour detection.

## Quick checklist
- [ ] trusting_period < unbonding (~⅔)
- [ ] Dedicated, alert-monitored relayer keys
- [ ] gas_multiplier tuned and tested under load
- [ ] Packet timeouts sized for path latency
- [ ] Channel versions validated
- [ ] Pending-packet and client-expiry monitoring live
- [ ] Relayer supervised with failover plan
- [ ] Timeout/refund path tested on testnet
