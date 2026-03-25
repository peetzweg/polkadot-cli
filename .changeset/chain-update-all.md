---
"polkadot-cli": minor
---

Add `--all` flag to `dot chain update` to re-fetch metadata for all configured chains in parallel.

- `dot chain update --all` updates all chains concurrently
- Shows a summary with check/cross marks for each chain
- Failures don't block other chains (uses `Promise.allSettled`)
- Exits with non-zero if any chain fails
