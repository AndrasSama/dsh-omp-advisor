---
name: cosmos-sdk-scaffolding
description: Equips the advisor to evaluate Cosmos SDK chain and module scaffolding for correct structure, codegen hygiene, and app-wiring mistakes.
---

# Cosmos SDK Scaffolding

Reviews new appchain scaffolding — Ignite CLI output, module layout, keeper wiring, proto codegen. Scaffolding errors bake in early: wrong module-account permissions, hand-edited generated code, or broken app wiring that only surfaces at genesis or upgrade time.

## Watch for
- Hand-edits in `*.pb.go` / `*.pb.gw.go` — generated code must change only via `buf generate` / protoc.
- Keepers constructed without capability gating: a module holding a bank keeper with mint/burn rights it doesn't need.
- Module accounts registered without explicit permissions, or with `Minter`/`Burner` granted by default.
- `app.go` wiring order mistakes: module manager order (InitGenesis/BeginBlock) inconsistent with the upgrade plan.
- Messages missing `ValidateBasic`, or `ValidateBasic` performing state reads — it must be stateless.
- Ignite scaffold leftovers (example modules, unused queries) shipped into a production chain.
- SDK version pinned loosely (floating minor) — consensus-critical code needs exact pinning.
- Custom AnteHandlers appended without understanding the default decorator chain (fee, signature, sequence ordering).

## Best practices
- Scaffold with `ignite scaffold chain/module/message/query`; regenerate with `buf` after every proto change; never patch generated files.
- Apply least privilege to keepers: pass scoped keepers and justify every module-account permission (`authtypes.Minter` etc.) explicitly.
- Keep `ValidateBasic` pure and cheap; defer all state-dependent checks to the msg server.
- Pin exact SDK, CometBFT, and ibc-go versions; upgrade deliberately with registered migration handlers.
- Register module accounts and permissions in one reviewed place; document the supply flow per account.
- Order module InitGenesis/EndBlock deterministically and record the rationale — changes are consensus-breaking.
- Add simulation (`x/simulation`) and invariant checks for any module that holds value.
- Remove scaffold examples before first release; diff against fresh scaffold output to isolate custom changes.

## Quick checklist
- [ ] No hand-edits in generated pb files
- [ ] Keeper capabilities least-privilege reviewed
- [ ] Module account permissions explicit and justified
- [ ] ValidateBasic stateless
- [ ] Exact dependency versions pinned
- [ ] Module manager ordering deliberate and documented
- [ ] AnteHandler chain changes reviewed end-to-end
- [ ] Scaffold examples removed
