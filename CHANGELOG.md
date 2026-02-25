# polkadot-cli

## 0.2.0

### Minor Changes

- 6b54658: Add account management and extrinsic submission

  - `dot account create|import|list|remove` — manage named accounts with BIP39 mnemonics or hex seeds
  - `dot tx Pallet.Call [...args] --from <name>` — build, sign, and submit extrinsics with metadata-aware arg parsing
  - `--dry-run` flag to estimate fees without submitting
  - Built-in dev accounts (Alice..Ferdie) always available for testnets
