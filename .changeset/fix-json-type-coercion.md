---
"polkadot-cli": patch
---

Fix `value.asBytes is not a function` error when encoding complex JSON arguments (e.g. XCM calls) that contain nested byte arrays, large numbers, or null option values. The `normalizeValue` function now converts hex strings to `Binary` for `[u8; N]`/`Vec<u8>` fields, coerces string primitives from JSON to proper types (`BigInt` for u128, `parseInt` for u32), and maps JSON `null` to `undefined` for `Option::None`.
