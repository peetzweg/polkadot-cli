---
"polkadot-cli": minor
---

Add calls/extrinsics to `dot inspect`. Pallet overviews now show a "Calls:" section listing all available extrinsics alongside storage items and constants. Use `dot inspect Balances.transfer_allow_death` to see a call's argument signature and documentation. Call names are also included in typo suggestions.
