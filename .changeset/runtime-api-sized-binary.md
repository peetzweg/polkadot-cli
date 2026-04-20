---
"polkadot-cli": patch
---

Fix `Incompatible runtime entry RuntimeCall(...)` when calling runtime APIs that
take a fixed-size byte array argument (e.g. `ReviveApi.call` with its
`dest: [u8; 20]` H160 contract address).

Previously, every `0x…`-hex argument typed as `[u8; N]` was decoded into a
`Uint8Array` via `Binary.fromHex(...)`. polkadot-api's `isCompatible`
maps `[u8; N]` to a *sized* binary typedef and only accepts a
`0x`-prefixed string for that shape — a `Uint8Array` is rejected, surfacing as
`Error: Incompatible runtime entry RuntimeCall(<Api>_<method>)` before any RPC
round-trip. `Vec<u8>` (unsized binary) was unaffected and continues to use
`Uint8Array`.

```bash
# Now works (previously failed with "Incompatible runtime entry"):
ALICE=5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
CONTRACT=0x970951a12f975e6762482aca81e57d5a2a4e73f4
CALLDATA=$(cast calldata "set(uint256)" 42)

dot --chain paseo-asset-hub apis.ReviveApi.call \
  "$ALICE" "$CONTRACT" 0 null null "$CALLDATA"
```

The argument-parsing rule is now:

- `Vec<u8>` (sequence of `u8`) → `Uint8Array` via `Binary.fromHex` / `Binary.fromText`
- `[u8; N]` (sized array of `u8`) with a `0x…` input → passed through as a
  `0x`-hex string (papi's dynamic builder encodes both forms; the compatibility
  guard only accepts the string form for sized binary)
- `[u8; N]` with a non-hex input → still falls back to `Binary.fromText`

Non-byte sized arrays (`[u32; N]`, etc.) are unaffected.

Documentation also clarifies how to pass `Option<T>` arguments. `null` is the
recommended `None` literal (JSON/YAML-compatible); `none` and `undefined` are
accepted aliases. A bare value is treated as `Some(value)` — there is no
explicit `Some(...)` prefix. The literals are lowercase-only.

