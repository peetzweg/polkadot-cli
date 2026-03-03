---
"polkadot-cli": patch
---

Exit with non-zero code when a transaction has a dispatch error (e.g. `Balances.InsufficientBalance`). Module errors are now formatted as `PalletName.ErrorVariant` instead of raw JSON. The full transaction output (events, explorer links) is still printed before the error.
