---
"polkadot-cli": patch
---

Document the recommended `{relay}-{parachain}` chain-naming convention for `dot chain add` and the relay/parachain topology feature. The docs site, README, and `dot-cli` skill now explain why relay-prefixed names (`polkadot-asset-hub`, `kusama-bridge-hub`, …) keep the `dot chain list` tree readable and disambiguate parachains whose IDs collide across relays. Docs-only — no behavior change.
