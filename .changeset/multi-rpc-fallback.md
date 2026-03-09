---
"polkadot-cli": minor
---

Support multiple RPC endpoints per chain with automatic fallback. Built-in chains now ship with fallback providers. Use repeated `--rpc` flags to configure multiple endpoints: `dot chain add kusama --rpc wss://a --rpc wss://b`. If the primary endpoint is unreachable, the CLI automatically tries the next one. Existing single-RPC configs continue to work unchanged.
