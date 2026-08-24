---
name: tendermint-consensus-tuning
description: Equips the advisor to evaluate CometBFT/Tendermint consensus configuration — timeouts, block sizing, and mempool settings — against liveness and latency goals.
---

# Tendermint Consensus Tuning

Reviews CometBFT (Tendermint) `config.toml` and genesis `consensus_params` against the chain's liveness and latency goals. Aggressive timeouts cause round churn and missed blocks; oversized blocks exceed gas limits and stall proposers.

## Watch for
- `timeout_commit` pushed below ~1 s for "faster blocks" — starves vote gossip on real networks and causes missed rounds.
- `timeout_propose`/`timeout_prevote` tuned without scaling the matching `timeout_*_delta` — asymmetric validators churn.
- `max_tx_bytes` and `max_gas` inconsistent: blocks fill with txs whose total exceeds the block gas limit.
- Mempool `size`/`max_txs_bytes` unbounded — proposer memory blowouts under spam.
- `max_validators` raised without considering voting-power distribution and proposer rotation variance.
- Evidence params (`max_age_num_blocks`) mismatched with unbonding time — stale evidence or missed slashing windows.
- P2P `max_num_inbound_peers` too low for the network diameter; sentries can't reach validators.
- Genesis `consensus_params` edited after launch without a coordinated upgrade — consensus fork.

## Best practices
- Start from CometBFT defaults; change one knob at a time with load tests on a realistic validator set and latency distribution.
- Keep block time at least ~3× p99 vote-propagation latency; document the math.
- Size `max_tx_bytes` below what `max_gas` allows; keep blocks within the app's processing budget.
- Bound the mempool by count and bytes; size `cache_size` to dedup replays.
- Align evidence `max_age` with the unbonding period so light-client attacks remain slashable.
- Monitor consensus rounds per height, vote gossip latency, and proposer miss rate; tune from data.
- Test consensus_params upgrades on a testnet with the same validator topology.
- Keep validator configs in version control with diffs reviewed like code.

## Quick checklist
- [ ] Timeouts justified against measured network latency
- [ ] Block size and gas limits mutually consistent
- [ ] Mempool bounded by count and bytes
- [ ] Evidence max_age aligned with unbonding
- [ ] Peer limits sized for network diameter
- [ ] consensus_params changes go through coordinated upgrade
- [ ] Round churn and miss rate monitored
- [ ] Config diffs reviewed in version control
