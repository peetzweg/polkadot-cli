---
"polkadot-cli": minor
---

Add events and errors to `dot inspect`. Add focused listing commands: `dot calls`, `dot events`, `dot errors`, `dot storage`, and `dot pallets` for browsing specific metadata categories. Make `dot const` dual-purpose — `dot const Balances` now lists constants while `dot const Balances.ExistentialDeposit` still looks up the value. All focused commands support chain prefix syntax and detail views.
