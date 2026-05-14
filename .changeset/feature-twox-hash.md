---
"polkadot-cli": minor
---

feat(hash): add `twox64`, `twox128`, `twox256` algorithms

Substrate uses XXH64-based `twox*` hashes throughout — pallet/storage prefixes
are `twox128(palletName) ++ twox128(itemName)`, and `Twox64Concat` is a common
storage-map hasher. Previously `dot hash` only supported the BLAKE2b, Keccak,
and SHA-2 families, so constructing a raw storage key required an external
tool.

The three new algorithms are pure-TypeScript (no wasm, no native deps) and
verified against canonical XXH64 vectors and Substrate prefixes:

- `dot hash twox128 System` → `0x26aa394eea5630e07c48ae0c9558cef7`
- `dot hash twox128 Balances` → `0xc2261276cc9d1f8598ea4b6a74b15c2f`
- `dot hash twox64 <key>` / `dot hash twox256 <key>` for the other variants

Combined with `dot [chain.]rpc.state_getStorage 0x<key>`, this is enough to
read any raw storage value, including the well-known keys (`:code`,
`:heappages`) that live outside metadata.
