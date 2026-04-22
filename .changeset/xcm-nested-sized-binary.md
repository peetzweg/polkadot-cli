---
"polkadot-cli": patch
---

Fix `Incompatible runtime entry Tx(...)` when submitting XCM extrinsics whose
JSON args contain a nested `[u8; N]` field (e.g. `AccountId32.id` inside a
`DepositAsset` beneficiary, or inside `custom_xcm_on_dest` for
`PolkadotXcm.transfer_assets_using_type_and_then`).

```bash
# Now works (previously failed with "Incompatible runtime entry" on dry-run/submit):
dot polkadot-asset-hub.tx.PolkadotXcm.transfer_assets_using_type_and_then \
  '{"type":"V4","value":{"parents":1,"interior":{"type":"X1","value":[{"type":"Parachain","value":1004}]}}}' \
  '{"type":"V4","value":[{"id":{"parents":0,"interior":{"type":"X2","value":[{"type":"PalletInstance","value":50},{"type":"GeneralIndex","value":"1337"}]}},"fun":{"type":"Fungible","value":"1000000000000"}}]}' \
  LocalReserve \
  '{"type":"V4","value":{"parents":0,"interior":{"type":"X2","value":[{"type":"PalletInstance","value":50},{"type":"GeneralIndex","value":"1337"}]}}}' \
  LocalReserve \
  '{"type":"V4","value":[{"type":"DepositAsset","value":{"assets":{"type":"Wild","value":{"type":"All"}},"beneficiary":{"parents":0,"interior":{"type":"X1","value":{"type":"AccountId32","value":{"network":null,"id":"0xae89f7d3ddb5b5d7ff4323d1699e71fe061138de0c74316263c5bcf935023249"}}}}}}]}' \
  Unlimited \
  --from alice --dry-run
```

`normalizeValue` (the recursive normalizer for nested JSON args) always wrapped
hex-string `u8` arrays in `Binary.fromHex(...)`. For *sized* `[u8; N]` fields
this produced a `Binary` / `Uint8Array` that PAPI's substrate-bindings codec
silently encodes as zero-length bytes, yielding a truncated call that
subsequently fails PAPI's `isCompat` check with `Incompatible runtime entry
Tx(<Pallet>.<call>)`. `--encode` masked the bug (no `isCompat` check and no
round-trip), so the problem only surfaced on `--dry-run` and actual submission.

`normalizeValue` now mirrors `parseTypedArg`'s existing sized-vs-unsized rule:

- `[u8; N]` (sized array of `u8`) with a `0x…` input → passed through as a
  `0x`-hex string so PAPI's codec encodes it correctly
- `Vec<u8>` (sequence of `u8`) → still wrapped in `Binary` via `Binary.fromHex`
  / `Binary.fromText`
- Non-byte arrays/sequences are unaffected

This completes the sibling fix for runtime-API args (`fix: pass [u8; N]
runtime-API args as 0x hex string`); both code paths now agree on the shape
PAPI expects.
