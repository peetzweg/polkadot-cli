---
"polkadot-cli": minor
---

Add transaction options: `--nonce`, `--tip`, `--mortality`, and `--at` flags for `dot tx`.

- `--nonce <n>` overrides the auto-detected nonce, enabling rapid-fire submission of multiple extrinsics without waiting for each to finalize
- `--tip <amount>` adds a priority tip (in planck) to the transaction pool
- `--mortality <spec>` controls transaction lifetime: `immortal` for no expiry, or a period number (minimum 4) for a custom mortality window
- `--at <block>` specifies which block state to validate against (`best`, `finalized`, or a block hash)
- All options are passed through to polkadot-api's `TxOptions` and work with `--dry-run`, file-based commands, and all wait levels
