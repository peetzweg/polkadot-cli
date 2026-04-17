---
"polkadot-cli": minor
---

Add `--asset <json>` flag for paying transaction fees in a non-native asset.

**New: `--asset` flag on `dot tx`**

Accepts an XCM location (JSON) and routes it through the `ChargeAssetTxPayment`
signed extension so the transaction is paid in the specified asset instead of the
chain's native token. Typically used on asset-hub-style chains (Polkadot, Paseo,
etc.) where an asset-conversion pool swaps the native fee into the chosen asset at
dispatch time.

```bash
# Pay fees in USDT (asset id 1337) on Polkadot Asset Hub
dot tx Balances.transfer_keep_alive 5FHneW46... 1000000000000 \
  --from alice --chain polkadot-asset-hub \
  --asset '{"parents":0,"interior":{"type":"X2","value":[{"type":"PalletInstance","value":50},{"type":"GeneralIndex","value":"1337"}]}}'

# Dry-run to estimate fees before submitting
dot tx Balances.transfer_keep_alive 5FHneW46... 1000000000000 \
  --from alice --chain polkadot-asset-hub --dry-run \
  --asset '{…location…}'
```

**How it works**

When `--asset` is supplied, the CLI takes over `ChargeAssetTxPayment` handling
from polkadot-api: it removes the extension from papi's builtin set, injects a
user override of `{ tip, asset_id }`, and lets the existing custom-signed-extension
pipeline SCALE-encode the value via metadata. This bypasses papi's
`isAssetCompat` check, which otherwise rejects XCM Location payloads on the
unsafe API path.

**Requirements**

- The target chain must expose the `ChargeAssetTxPayment` signed extension
  (asset-hub-style chains); on chains without it, `--asset` is silently ignored.
- The estimated fee shown in `--dry-run` output is native-denominated; the
  on-chain asset-conversion pool determines the actual asset amount charged.

**Not combinable with `--unsigned`** — unsigned/general transactions already
default `ChargeAssetTxPayment` to zero tip / no asset.
