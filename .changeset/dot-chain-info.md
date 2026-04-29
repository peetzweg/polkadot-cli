---
"polkadot-cli": minor
---

Clean up `dot chains` output and add `dot chain info <name>` for per-chain detail.

**`dot chains` is now scannable**

The default `dot chains` (and `dot chain list`) output no longer prints RPC URLs inline. The list view becomes a compact tree of names + relay structure + parachain IDs:

```
Configured Chains

  polkadot
  ├─ polkadot-asset-hub [1000]
  ├─ polkadot-bridge-hub [1002]
  ├─ polkadot-collectives [1001]
  ├─ polkadot-coretime [1005]
  └─ polkadot-people [1004]

  paseo
  ├─ paseo-asset-hub [1000]
  └─ paseo-people [1004]
```

Pass `-v` / `--verbose` (à la `git remote -v`) to keep the previous behavior with RPC endpoints inline:

```bash
dot chains -v
dot chain list --verbose
```

**`dot chain info <name>`**

A new `info` action prints full per-chain detail in one block — RPC endpoints, relay/parachain id, child parachains (when the target is a relay), and metadata cache status:

```bash
dot chain info polkadot

# polkadot
#
#   rpc:
#     wss://polkadot.ibp.network
#     wss://rpc.polkadot.io
#     ...
#   parachains:
#     polkadot-asset-hub [1000]
#     polkadot-bridge-hub [1002]
#     ...
#   metadata:
#     polkadot v1003000 (cached 2026-04-29T12:34:56.000Z)
```

`dot chain <name>` is a bare-noun shortcut that falls through to `chain info <name>` — like `gh repo view`. The dispatcher still pattern-matches known action verbs first (`add`, `remove`, `update`, `list`, `export`, `import`), so existing usage is unchanged.

`--json` emits a structured object with `name`, `rpc[]`, optional `relay` / `parachainId`, optional `parachains[]`, and a `metadata` block (or `null` when no fingerprint is cached). Names resolve case-insensitively, matching `findChainName` semantics used elsewhere.

When metadata has never been fetched for the chain, the metadata row prints `not cached — run \`dot chain update <name>\`` so it's clear how to populate it.
