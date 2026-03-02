---
"polkadot-cli": patch
---

Fix `inner[tag] is not a function` error when passing XCM types (like `Junctions::X1`) to `dot tx`. polkadot-api unwraps `[T; 1]` fixed arrays in metadata, but users naturally pass single-element arrays per the XCM spec. The CLI now auto-detects this mismatch and unwraps accordingly.
