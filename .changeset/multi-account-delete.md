---
"polkadot-cli": minor
---

Support deleting multiple accounts in one command: `dot account delete wallet1 wallet2 wallet3`. All names are validated upfront — if any name is invalid or not found, no accounts are removed (atomic semantics).
