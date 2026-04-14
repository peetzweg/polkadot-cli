---
"polkadot-cli": minor
---

Add chain topology management with relay/parachain hierarchy awareness.

**New: `relay` and `parachainId` fields in chain config**

Chains now understand their position in the relay/parachain hierarchy. All built-in system parachains are preconfigured with their relay chain and parachain ID.

**New: `--relay` and `--parachain-id` flags for `dot chain add`**

When adding a custom chain, specify its parent relay chain. The parachain ID is auto-detected from on-chain `ParachainInfo.ParachainId` storage when omitted:

```bash
# Add a relay chain
dot chain add local-relay --rpc ws://localhost:9944

# Add a parachain (auto-detects parachain ID)
dot chain add local-asset-hub --rpc ws://localhost:9945 --relay local-relay

# Explicit parachain ID
dot chain add my-para --rpc wss://rpc.example.com --relay polkadot --parachain-id 2000
```

**New: hierarchical `dot chain list` display**

`dot chain list` now renders chains as a tree, grouping parachains under their relay:

```
Configured Chains

  polkadot (default)  wss://polkadot.ibp.network
  ├─ polkadot-asset-hub [1000]  wss://...
  ├─ polkadot-bridge-hub [1002]  wss://...
  ├─ polkadot-collectives [1001]  wss://...
  ├─ polkadot-coretime [1005]  wss://...
  └─ polkadot-people [1004]  wss://...

  paseo  wss://paseo.ibp.network
  ├─ paseo-asset-hub [1000]  wss://...
  └─ paseo-people [1004]  wss://...

  my-solo-chain  wss://...
```

**JSON output updated**

`dot chain list --json` now includes `relay` and `parachainId` fields for parachain entries.

**Orphan warning on relay removal**

Removing a chain that other chains reference as their relay prints a warning listing orphaned parachains.

**Config backward compatible**

Existing saved configs are automatically migrated — built-in chains gain topology fields from defaults while preserving user RPC overrides.
