---
"polkadot-cli": minor
---

Remove Smoldot light client support. The `--light-client` global flag, `dot chain add <name> --light-client` command, and all underlying light client connection logic have been removed. Chains now always connect via WebSocket RPC. Existing user configs with `lightClient: true` are gracefully ignored and fall through to the configured RPC endpoints. Light client support will be reintroduced properly in a future release (see #142).
