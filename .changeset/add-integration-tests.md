---
"polkadot-cli": patch
---

Add integration tests for all CLI commands (chain, account, inspect, hash, const, query, global) and document that account secrets are stored unencrypted. Also document that hex seed import via `--secret 0x...` is not supported due to a CLI parser limitation.
