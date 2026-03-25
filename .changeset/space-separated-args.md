---
"polkadot-cli": patch
---

Fix space-separated arguments not being recognized as pallet/item segments when used with `--chain` flag or category-only dot-paths.

- `dot --chain polkadot api Core` now correctly lists Core methods (previously showed global API list)
- `dot query System` now lists System storage items (equivalent to `dot query.System`)
- `dot events Balances Transfer` now shows Transfer event detail (equivalent to `dot events.Balances.Transfer`)
- Applies to all categories: query, tx, const, events, errors, apis
