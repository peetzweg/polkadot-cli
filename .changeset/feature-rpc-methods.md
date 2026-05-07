---
"polkadot-cli": minor
---

feat(rpc): add `dot [chain.]rpc.<method>` for raw JSON-RPC calls

Closes #196.

Substrate nodes expose a JSON-RPC surface (`system_*`, `chain_*`, `state_*`,
`author_*`, `payment_*`, consensus and dev families, plus the new spec
`chainSpec_v1_*` / `archive_v1_*` / `rpc_methods`) that is separate from
runtime metadata and was previously unreachable from this CLI.

The new `rpc` category mirrors the other dotpath commands: methods are
discovered per-chain via `rpc_methods`, cached at
`~/.polkadot/chains/<chain>/rpc-methods.json`, and tab-completed.

- `dot polkadot.rpc` — list methods grouped by family
- `dot polkadot.rpc.system_health` — call a method
- `dot polkadot.rpc.chain_getBlock 0x<hash>` — positional args
- `dot polkadot.rpc.<method> --help` — curated description and arg names
  for ~50 well-known methods; raw passthrough for the rest
- `dot polkadot.rpc --refresh` — re-discover methods on a node upgrade

Subscription methods (`*_subscribe*`, `chainHead_v1_follow`, `transaction_v1_*`)
appear in completion but error out as one-shots with a helpful message.

`dot chain add` and `dot chain update` now also fetch and cache the method
list, and `dot chain info` shows a per-family breakdown.
