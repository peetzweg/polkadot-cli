---
"polkadot-cli": minor
---

Add `dot sign` command for signing arbitrary messages with account keypairs. Accepts inline text, hex bytes (`0x`-prefixed), file contents (`--file`), or stdin (`--stdin`). Output shows the crypto type, message bytes in hex, raw signature, and a `Sr25519(0x...)` enum value directly usable as a `MultiSignature` argument in transaction calls. Supports `--output json` for structured output. Supports dev accounts, stored accounts, and env-backed accounts via `--from`. Signature type is configurable with `--type` (default: sr25519).
