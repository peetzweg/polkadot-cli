---
"polkadot-cli": minor
---

Add `--encode` flag to `dot tx` for encoding calls to hex without signing or submitting. Useful for preparing calls to be used with `Sudo.sudo`, multisig proposals, or governance. Works offline from cached metadata and does not require `--from`.
