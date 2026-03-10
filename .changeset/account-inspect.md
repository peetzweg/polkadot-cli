---
"polkadot-cli": minor
---

Add `dot account inspect` to convert between SS58 addresses, hex public keys, and account names. Accepts dev account names, stored account names, SS58 addresses, or `0x`-prefixed 32-byte public keys. Use `--prefix <N>` to encode with a specific SS58 prefix (default: 42). Supports `--output json` for machine-readable output. Unknown subcommands fall through to inspect, so `dot account alice` works as a shorthand for `dot account inspect alice`.
