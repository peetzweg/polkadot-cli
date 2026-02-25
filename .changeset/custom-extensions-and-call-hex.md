---
"polkadot-cli": minor
---

feat: auto-handle custom signed extensions and display encoded call hex

- Auto-detect non-standard signed extensions from chain metadata and provide sensible defaults (void → empty bytes, Option → None, enum with Disabled variant → Disabled). This fixes `dot tx` on chains like people-preview that have extensions such as `VerifyMultiSignature` and `PeopleLiteAuth`.
- Add `--ext <json>` flag to manually override or provide custom signed extension values for complex cases.
- Display SCALE-encoded call data hex in both dry-run and submission output, useful for pasting into call decoders.
