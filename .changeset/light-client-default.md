---
"polkadot-cli": minor
---

Make light client the default connection mode for built-in chains

Chains with a known chain spec in `KNOWN_CHAIN_SPECS` (10 of 12 built-in chains) now connect via the embedded Smoldot light client by default — no RPC endpoint configuration needed.

- **New users:** Light client is used automatically for known chains (empty RPCs in default config)
- **Existing users:** Saved config RPCs are respected — no silent behavior change
- **Override:** Use `--rpc <url>` per-command or `dot chain add <name> --rpc <url>` to persist RPC endpoints
- **Re-enable light client:** `dot chain add <name>` (without `--rpc`) resets to light client mode

The `--light-client` flag has been removed as it is no longer needed. Explorer links fall back to a representative RPC when connected via light client.
