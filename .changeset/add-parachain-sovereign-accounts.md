---
"polkadot-cli": minor
---

Add `dot parachain` command to derive sovereign account addresses for parachains.

- `dot parachain 1000` shows both child and sibling sovereign accounts for a given parachain ID
- Child accounts (`"para"` prefix) represent a parachain on the relay chain
- Sibling accounts (`"sibl"` prefix) represent a parachain on another parachain
- `--type child` or `--type sibling` to show only one type
- `--prefix <N>` to control the SS58 address encoding (default: 42)
- `--output json` for pipe-safe structured output
- Runs offline — no chain connection required
- No new dependencies — uses existing SS58 encoding utilities
