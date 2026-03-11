---
"polkadot-cli": minor
---

Add item-level `--help` for fully-qualified dot-path commands. Running `dot tx.System.remark --help`, `dot query.System.Account --help`, `dot const.Balances.ExistentialDeposit --help`, etc. now shows metadata detail (args, types, docs) and category-specific usage hints — all offline without connecting to the chain. For `tx` commands, omitting `--from` and `--encode` now shows this same help output instead of a terse error.
