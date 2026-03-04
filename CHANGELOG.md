# polkadot-cli

## 0.7.0

### Minor Changes

- d97f5e3: Add `dot chains` and `dot accounts` shorthands that list all chains and accounts without the explicit `list` subcommand. Running `dot chain` or `dot account` with no action now also defaults to listing instead of showing help text. `dot chain list` and `dot account list` continue to work as before.
- ba05ba0: Add update notifier that shows a boxed notification when a new version of polkadot-cli is available on npm. The check runs in the background on startup, caches results for 24 hours in `~/.polkadot/update-check.json`, and never blocks the CLI. Disable with `DOT_NO_UPDATE_CHECK=1`; automatically suppressed in CI environments and non-TTY output.

### Patch Changes

- 0a68bd1: Fix `dot query` for storage maps with composite keys (e.g. `Hrmp.HrmpChannels`). Positional CLI args are now composed into structs using metadata field names, so `dot query Hrmp.HrmpChannels 1000 5140` correctly passes `{ sender: 1000, recipient: 5140 }` instead of two separate arguments. Also adds metadata-aware parsing for NMap (multi-hasher) keys and descriptive error messages for wrong argument counts.

## 0.6.2

### Patch Changes

- a95d1eb: Exit with non-zero code when a transaction has a dispatch error (e.g. `Balances.InsufficientBalance`). Module errors are now formatted as `PalletName.ErrorVariant` instead of raw JSON. The full transaction output (events, explorer links) is still printed before the error.
- 254e693: Show finalized block number as a checkmark in the transaction progress spinner instead of a separate Block line in the summary output

## 0.6.1

### Patch Changes

- 4f47747: Add integration tests for all CLI commands (chain, account, inspect, hash, const, query, global) and document that account secrets are stored unencrypted. Also document that hex seed import via `--secret 0x...` is not supported due to a CLI parser limitation.
- 63f8b52: Fix `value.asBytes is not a function` error when encoding complex JSON arguments (e.g. XCM calls) that contain nested byte arrays, large numbers, or null option values. The `normalizeValue` function now converts hex strings to `Binary` for `[u8; N]`/`Vec<u8>` fields, coerces string primitives from JSON to proper types (`BigInt` for u128, `parseInt` for u32), and maps JSON `null` to `undefined` for `Option::None`.

## 0.6.0

### Minor Changes

- a21f8b9: Add `--encode` flag to `dot tx` for encoding calls to hex without signing or submitting. Useful for preparing calls to be used with `Sudo.sudo`, multisig proposals, or governance. Works offline from cached metadata and does not require `--from`.
- 805ae11: Add `dot hash` command for computing cryptographic hashes (BLAKE2b-256, BLAKE2b-128, Keccak-256, SHA-256). Supports hex input, plain text, file contents, and stdin.

### Patch Changes

- 2d53556: Fix `inner[tag] is not a function` error when passing XCM types (like `Junctions::X1`) to `dot tx`. polkadot-api unwraps `[T; 1]` fixed arrays in metadata, but users naturally pass single-element arrays per the XCM spec. The CLI now auto-detects this mismatch and unwraps accordingly.

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
