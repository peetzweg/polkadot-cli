---
"polkadot-cli": patch
---

Add XCM transfer examples to documentation: teleport DOT and reserve transfer USDC from polkadot-asset-hub.

- Teleport DOT example: Asset Hub to relay chain via `PolkadotXcm.limited_teleport_assets`
- Reserve transfer USDC (asset 1337) example: Asset Hub to Hydration (parachain 2034) via `PolkadotXcm.limited_reserve_transfer_assets`
- Both YAML and JSON formats shown
- Examples verified via integration tests against relay chain metadata
