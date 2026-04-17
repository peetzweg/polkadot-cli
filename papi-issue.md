# `isAssetCompat` rejects valid XCM Location payload when using the unsafe API

## Summary

When using `getUnsafeApi()` on an asset-hub-style chain (where the `ChargeAssetTxPayment`
signed extension's `asset_id` is an `Option<XcmV*MultiLocation>`), passing an otherwise valid
XCM Location as `asset` via `TxOptions.asset` always throws `Incompatible runtime asset`.

The check that rejects it lives in
[`packages/client/src/tx/tx.ts`](../packages/client/src/tx/tx.ts) lines 119‑129:

```ts
const getEncodedAsset$ = (asset: any, at: HexString | null) =>
  asset === undefined
    ? of(undefined)
    : getCompatCtx$(at).pipe(
        map(({ ctx, isAssetCompat }) => {
          if (!isAssetCompat(asset))
            throw new Error(`Incompatible runtime asset`)
          ...
        }),
      );
```

`isAssetCompat` ultimately calls `isCompatible(asset, getTypeDefNode(assetId), getTypeDefNode)`
from `metadata-compatibility` (see `packages/client/src/compatibility/compat-ctx.ts:112-114`).
For the unsafe API path this check has no generated descriptor to compare against and seems
to reject valid Location JSON regardless.

## Environment

- `polkadot-api` 2.0.1 and 2.0.2 (reproduced on both)
- Node 20 / Bun 1.x
- Chain: any asset-hub with `ChargeAssetTxPayment` whose `asset_id` is an
  `Option<MultiLocation>` (verified on a Paseo‑based preview asset-hub running Polkadot SDK
  master, should also reproduce on `paseo-asset-hub`).

## Expected behaviour

Either:

1. `isAssetCompat` accepts an asset value whose shape structurally matches the metadata
   typedef for the extension's `asset_id` field (XCM Location JSON matches the typedef of
   `StagingXcmV5Location` in metadata), **or**
2. The unsafe API exposes an escape hatch (e.g. `skipAssetCompatCheck: true`) so consumers
   that don't use generated descriptors can opt into SCALE‑encoding the asset directly from
   metadata.

## Actual behaviour

`tx.getEstimatedFees(from, { asset })` throws `Error: Incompatible runtime asset` before any
network round‑trip. Same error for `tx.sign(...)`/`signAndSubmit(...)`.

## Workaround

Skip papi's built-in handler for `ChargeAssetTxPayment` by passing the asset via
`customSignedExtensions`, relying on papi's metadata dynamic builder to SCALE‑encode the
value. Shipped in `polkadot-cli` in commit `ad7f3a8` — see
[`src/commands/tx.ts:318-345`](https://github.com/peetzweg/polkadot-cli/blob/feature-asset-payment/src/commands/tx.ts#L318-L345).

## Minimal reproduction

```ts
// repro.ts — run with `bun repro.ts` or `npx tsx repro.ts`
// Reproduces "Incompatible runtime asset" against a public asset-hub.
import { createClient } from "polkadot-api"
import { getWsProvider } from "polkadot-api/ws-provider/web"

// Public Paseo AssetHub endpoint (swap for any asset-hub that exposes
// ChargeAssetTxPayment with Option<MultiLocation> asset_id).
const WSS = "wss://asset-hub-paseo-rpc.dwellir.com"

// Asset id for USDT on Paseo AssetHub (pallet instance 50, general index 1337).
// Change to any asset id registered on the target chain.
const assetLocation = {
  parents: 0,
  interior: {
    type: "X2",
    value: [
      { type: "PalletInstance", value: 50 },
      { type: "GeneralIndex", value: 1337n },
    ],
  },
}

const ALICE_PUBKEY_HEX =
  "0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d" // //Alice

async function main() {
  const client = createClient(getWsProvider(WSS))
  try {
    const api = client.getUnsafeApi()

    const tx = api.tx.Balances.transfer_keep_alive({
      dest: { type: "Id", value: ALICE_PUBKEY_HEX }, // self-transfer is fine for estimation
      value: 1_000_000n,
    })

    const fees = await tx.getEstimatedFees(
      Uint8Array.from(Buffer.from(ALICE_PUBKEY_HEX.slice(2), "hex")),
      // Native asset option — rejected by `isAssetCompat`.
      { asset: assetLocation },
    )

    console.log("estimated fees:", fees)
  } catch (err) {
    console.error("threw:", (err as Error).message) // -> "Incompatible runtime asset"
    process.exitCode = 1
  } finally {
    client.destroy()
  }
}

main()
```

Expected output:

```
threw: Incompatible runtime asset
```

## Notes

- The same call succeeds if the asset SCALE blob is encoded via
  `dynamicBuilder.buildDefinition(<ChargeAssetTxPayment value type>)[0]` from the chain
  metadata and injected through `customSignedExtensions.ChargeAssetTxPayment` — which is
  exactly what `polkadot-cli` does as a workaround.
- This suggests the encoder has no problem with the payload; the `isCompatible` guard is the
  only thing blocking the native path.
- Possibly related: value fields containing `Compact<u128>` (e.g. `GeneralIndex.value`) need
  to be `bigint`; the reproduction above already uses `bigint`. If the root cause is the
  shape/JSON form of the enum discriminator, that would be useful to document as well.

## Happy to help

Willing to pair on a fix / add a test to the compatibility suite once the intended behaviour
is decided.
