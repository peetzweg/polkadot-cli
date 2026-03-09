---
"polkadot-cli": minor
---

Add `--path` option to `account create`, `account import`, and a new `account derive` action for derivation path support. Accounts created or imported with a path derive a different keypair from the same secret. `account list` shows the derivation path alongside the account name.
