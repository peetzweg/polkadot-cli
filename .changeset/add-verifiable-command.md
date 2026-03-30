---
"polkadot-cli": minor
---

Add `dot verifiable` command to derive Bandersnatch member keys from account mnemonics using the `verifiablejs` WASM library. Supports both unkeyed (lite person) and keyed derivation (e.g. `candidate` for full person). Derived keys are saved to the account store and displayed in `account inspect` and `account create` output.
