---
"polkadot-cli": patch
---

Fix enum variant names not recognized as storage query keys.

Enum variants whose metadata type is wrapped in `lookupEntry` indirection (e.g. `{ type: "lookupEntry", value: { type: "void" } }`) were not resolved before checking for void, causing them to fall through as raw strings. This produced a cryptic "Incompatible runtime entry" error when querying storage maps keyed by such enums (e.g. `ChunksManager.Chunks R2e9 1`). The same variants already worked in `--encode` via the shorthand path, which correctly resolved `lookupEntry` first.
