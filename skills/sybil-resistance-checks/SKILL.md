---
name: sybil-resistance-checks
description: Equips the advisor to evaluate an appchain's economic and protocol defenses against sybil attacks — staking gates, jail params, and governance spam controls.
---

# Sybil Resistance Checks

Reviews whether an appchain's admission and governance economics resist identity-flooding: validator entry costs, delegation concentration, governance deposit gates, and account-creation rate limits. Weak sybil resistance lets an attacker buy protocol capture cheaply.

## Watch for
- Zero or trivial minimum self-delegation — validators can be created at no cost.
- Governance `min_deposit` near zero — proposal spam fills queues and voting windows.
- Jail params too lenient: tiny `min_signed_per_window`, short `downtime_jail_duration`, near-zero `slash_fraction_downtime` — free-riding validators pay nothing.
- No rate limiting on account creation or faucet claims on incentivized testnets.
- Validator set capped low with low entry stake — cheap set capture.
- Delegation concentration unmonitored: a top-3 holding majority voting power.
- Commission bounds unchecked (permanent 0% commission allowed) enabling predatory centralization.
- Airdrop/incentive claims without uniqueness checks (same key recycling).

## Best practices
- Set a meaningful `min_self_delegation` relative to token value; review it as price moves.
- Require proposal deposits with burn-on-spam semantics; tune `min_deposit` to a real cost.
- Jail params with teeth: signing below ~5–10% of a 100–10k block window jails for hours with a non-zero slash fraction.
- Gate faucets/claims with proof-of-uniqueness or staged vesting; monitor claim graphs for sybil clusters.
- Size `max_validators` so set entry requires real stake; monitor the entry-threshold bond.
- Track and publish concentration metrics (e.g., stake share of top-N validators); alert on rapid centralization drift.
- Allow commission but set sane bounds; flag sustained 0%-commission campaigns.
- Simulate attacks on testnet: proposal spam, mass validator registration, faucet draining.

## Quick checklist
- [ ] min_self_delegation meaningful at current token value
- [ ] Proposal deposits deter spam (burn semantics)
- [ ] Downtime jail params impose real cost
- [ ] Faucet/claim uniqueness enforced
- [ ] Validator set entry cost monitored
- [ ] Power concentration metrics published
- [ ] Commission bounds reviewed
- [ ] Sybil scenarios tested on testnet
