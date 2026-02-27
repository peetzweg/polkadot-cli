# polkadot-cli

## 0.5.0

### Minor Changes

- 927068d: Show PolkadotJS Apps and PAPI Explorer links in the transaction summary after finalization
- f89ed8b: Show progressive transaction status with an animated spinner (signed → broadcasted → in best block → finalized) instead of a static "Signing and submitting..." message

### Patch Changes

- 04c86b1: Centralize process.exit(0) in cli.ts so commands exit immediately after completion instead of hanging on polkadot-api timers
- f555e58: Reorder README sections, document --ext flag and output display, add CI and release GitHub Actions workflows
- f555e58: Read CLI version from package.json instead of a hardcoded string to prevent version drift

## 0.4.0

### Minor Changes

- d963874: feat: support raw SCALE-encoded call hex in `dot tx`

  Users can now submit pre-encoded calls directly:

  ```bash
  dot tx 0x0503008eaf04151687736326c9fea17e25fc5287613693c912909cb226aa4794f26a48070010a5d4e8 --from alice
  ```

  Both raw hex and `Pallet.Call` forms now display a decoded human-readable representation of the call.

## 0.3.0

### Minor Changes

- e64ae85: feat: auto-handle custom signed extensions and display encoded call hex

  - Auto-detect non-standard signed extensions from chain metadata and provide sensible defaults (void → empty bytes, Option → None, enum with Disabled variant → Disabled). This fixes `dot tx` on chains like people-preview that have extensions such as `VerifyMultiSignature` and `PeopleLiteAuth`.
  - Add `--ext <json>` flag to manually override or provide custom signed extension values for complex cases.
  - Display SCALE-encoded call data hex in both dry-run and submission output, useful for pasting into call decoders.

## 0.2.1

### Patch Changes

- Fix `Vec<u8>` args (e.g. `System.remark`) to use `Binary` as polkadot-api expects
- Auto-wrap SS58 addresses into `MultiAddress.Id` for transfer calls

## 0.2.0

### Minor Changes

- 6b54658: Add account management and extrinsic submission

  - `dot account create|import|list|remove` — manage named accounts with BIP39 mnemonics or hex seeds
  - `dot tx Pallet.Call [...args] --from <name>` — build, sign, and submit extrinsics with metadata-aware arg parsing
  - `--dry-run` flag to estimate fees without submitting
  - Built-in dev accounts (Alice..Ferdie) always available for testnets
