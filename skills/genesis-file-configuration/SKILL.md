---
name: genesis-file-configuration
description: Equips the advisor to audit genesis.json construction — supply consistency, param sanity, gentx collection, and chain-id discipline.
---

# Genesis File Configuration

Reviews `genesis.json` before chain launch: initial balances, staking/gov/distribution params, consensus params, and gentx collection. A genesis mistake is either fatal (chain won't start) or permanent (wrong supply baked in at height 1).

## Watch for
- Sum of `bank.balances` not equal to staking pools + distribution + module accounts — supply inconsistency discovered post-launch.
- `gentx` delegations referencing accounts missing from balances, or self-delegation below `min_self_delegation`.
- `chain_id` not following the documented convention (`<name>-<n>`), breaking ledger/wallet signing.
- `voting_period`/`max_deposit_period` left at multi-week defaults on a testnet, or minutes on mainnet.
- `unbonding_time` inconsistent with evidence `max_age` and IBC trusting periods.
- Denom mismatches: base denom inconsistent across bank/staking/mint sections, or missing denom metadata exponents.
- Genesis time in a non-UTC or non-RFC3339 format.
- `consensus_params` (block max_gas/max_tx_bytes, evidence) missing or inconsistent with validator configs.

## Best practices
- Build genesis with scripts that compute balances from a reviewed allocation table; assert sum(balances) == declared supply in CI.
- Validate with the daemon's `validate-genesis` command plus custom invariant scripts.
- Collect gentxs via a documented process; verify each validator's pubkey, power, and commission bounds.
- Set params deliberately per environment: short voting/unbonding for testnets, conservative mainnet values with recorded rationale.
- Align unbonding_time ≥ IBC client trusting period and evidence max_age.
- Use the base denom (micro units, e.g. `u`-prefix) consistently; register denom metadata with exponents once.
- Make genesis construction reproducible: pinned tool versions, committed scripts, published output hash pre-launch.
- Dry-run the full launch: fresh nodes sync from genesis, run a testnet epoch, exercise governance and staking.

## Quick checklist
- [ ] Balances sum equals declared supply (scripted check)
- [ ] All gentx accounts funded and valid
- [ ] chain_id follows convention and matches docs
- [ ] Gov/staking params appropriate for the environment
- [ ] unbonding/evidence/trusting periods aligned
- [ ] Denom consistent across all modules
- [ ] validate-genesis passes
- [ ] Full dry-run launch performed
