# polkadot-cli

## 1.0.0

### Major Changes

- 6bc0964: Restructure CLI to use dot-path syntax. Categories (`query`, `tx`, `const`, `events`, `errors`) are now part of the dot-separated path instead of separate top-level commands.

  **Before:** `dot query System.Account <addr>`, `dot tx Balances.transfer_keep_alive <dest> <amount>`
  **After:** `dot query.System.Account <addr>`, `dot tx.Balances.transfer_keep_alive <dest> <amount>`

  New features:

  - Chain prefix is now a 4-segment path: `dot polkadot.query.System.Account`
  - Category-only invocation lists pallets: `dot query` lists pallets with storage items
  - Pallet-only invocation lists items: `dot query.System` lists storage items, `dot tx.Balances` lists calls
  - `explore` alias for `inspect`: `dot explore` and `dot explore System` work like `dot inspect`
  - Category aliases work in dot-paths: `consts`, `constants`, `event`, `error`

  Removed top-level commands: `call`/`calls`, `event`/`events`, `error`/`errors`, `storage`, `pallet`/`pallets`, standalone `query`, `tx`, `const`/`consts`/`constants`. Use the new dot-path syntax instead.

  Kept commands: `inspect` (+ `explore` alias), `chain`, `account`, `hash`.

## 0.14.0

### Minor Changes

- b52f508: Add events and errors to `dot inspect`. Add focused listing commands: `dot calls`, `dot events`, `dot errors`, `dot storage`, and `dot pallets` for browsing specific metadata categories. Make `dot const` dual-purpose — `dot const Balances` now lists constants while `dot const Balances.ExistentialDeposit` still looks up the value. All focused commands support chain prefix syntax and detail views.

### Patch Changes

- 6ada67a: Fix stdout pollution when piping `--output json` to tools like `jq`. Progress messages ("Fetching metadata...", "Connecting...", spinner output) now go to stderr instead of stdout, following Unix conventions. Commands like `dot const System.SS58Prefix --output json | jq .` now work correctly without JSON parse errors from interleaved progress text.
- bc94695: Show first complete sentence in listing views instead of raw metadata lines. Documentation strings were previously cut at metadata line boundaries, losing information mid-sentence. Listing summaries now join all doc lines and extract the first complete sentence, correctly handling abbreviations like `e.g.`, `i.e.`, and `etc.` so they don't cause early truncation. Type descriptions are no longer truncated either — the terminal handles line wrapping.

## 0.13.0

### Minor Changes

- 90d6915: Add `dot account inspect` to convert between SS58 addresses, hex public keys, and account names. Accepts dev account names, stored account names, SS58 addresses, or `0x`-prefixed 32-byte public keys. Use `--prefix <N>` to encode with a specific SS58 prefix (default: 42). Supports `--output json` for machine-readable output. Unknown subcommands fall through to inspect, so `dot account alice` works as a shorthand for `dot account inspect alice`.
- 092e81c: Add calls/extrinsics to `dot inspect`. Pallet overviews now show a "Calls:" section listing all available extrinsics alongside storage items and constants. Use `dot inspect Balances.transfer_allow_death` to see a call's argument signature and documentation. Call names are also included in typo suggestions.

### Patch Changes

- 533aa76: Improve argument parsing error messages with contextual information. When `parseTypedArg` fails (e.g. passing `"abc"` where a `Compact<u128>` is expected), the error now includes the argument name (for struct fields) or index (for tuples), the expected type, the invalid value, and a hint describing what the type expects. Previously, errors surfaced as raw JS exceptions (e.g. `Failed to parse String to BigInt`) with no context about which argument failed.
- 9b9a04e: Add fallback call decoder for XCM and complex types. When the primary view-builder decoder crashes (e.g. on `PolkadotXcm.limited_teleport_assets`), the CLI now falls back to `DynamicBuilder.buildDefinition()` which correctly handles these calls. Previously, complex XCM calls would show "(unable to decode)" in dry-run and transaction output.

## 0.12.0

### Minor Changes

- e811262: Add `--path` option to `account create`, `account import`, and a new `account derive` action for derivation path support. Accounts created or imported with a path derive a different keypair from the same secret. `account list` shows the derivation path alongside the account name.
- ab8919b: Support deleting multiple accounts in one command: `dot account delete wallet1 wallet2 wallet3`. All names are validated upfront — if any name is invalid or not found, no accounts are removed (atomic semantics).
- 13ecf03: Support multiple RPC endpoints per chain with automatic fallback. Built-in chains now ship with fallback providers. Use repeated `--rpc` flags to configure multiple endpoints: `dot chain add kusama --rpc wss://a --rpc wss://b`. If the primary endpoint is unreachable, the CLI automatically tries the next one. Existing single-RPC configs continue to work unchanged.
- 7e576b3: Add all system parachains as preconfigured chains with full RPC endpoint lists. Polkadot and Paseo now ship with Asset Hub, Bridge Hub, Collectives, Coretime, and People parachains out of the box. Existing chains (polkadot, paseo, polkadot-asset-hub, paseo-asset-hub, polkadot-people) have been updated with additional RPC providers. IBP endpoints are listed first as primary, with community providers as fallbacks. Light client chain specs are included for all chains where available.

### Patch Changes

- 3c5a2cc: Fix `--help` flag on subcommands (`dot account --help`, `dot chain --help`, `dot hash --help`) to show the same detailed custom help as running the bare command instead of CAC's generic auto-generated help.

## 0.11.0

### Minor Changes

- 77299c1: Merge `account add --env` into `account import` so that `import` accepts both `--secret` and `--env`. `add` is now an alias for `import` (like `new` for `create` and `delete` for `remove`).

### Patch Changes

- 3100e88: Add `new` as an alias for `account create` and `delete` as an alias for `account remove` for more natural command naming.
- 6ed0d38: Fix case-insensitive chain name resolution. Chain names like `Polkadot`, `POLKADOT`, or `Kusama` now resolve correctly in `--chain` flags, chain prefixes (e.g. `Polkadot.System.Number`), `chain default`, and `chain remove`.
- 112d7c9: Fix update notification never showing due to a race condition. The background version check now stores its promise and `process.exit()` waits up to 500ms for it to complete, ensuring the cache file is written before exit. Failed checks are cached for 1 hour to avoid repeated delays when the network is down.
- d859287: Show help text instead of listing items when running `dot account` or `dot chain` with no action. This is consistent with typical CLI behavior where bare subcommands show usage help. Use `dot account list` or `dot chain list` to list items explicitly.

## 0.10.0

### Minor Changes

- 5c46afa: Add environment-variable-backed accounts with `dot account add <name> --env <VAR>`. Instead of storing secrets on disk, the CLI stores a reference to an environment variable and reads the secret at signing time. Ideal for CI/CD pipelines and security-conscious workflows. The `account list` command shows an `(env: VAR)` badge for these accounts and resolves addresses live when the variable is set.

## 0.9.0

### Minor Changes

- 7b5eec7: Add ergonomic enum shorthand syntax for `dot tx` arguments. Instead of verbose JSON like `'{"type":"system","value":{"type":"Authorized"}}'`, you can now write `'system(Authorized)'`. Supports nested enums, case-insensitive variant matching, JSON inside parens for structs, and empty parens for void variants. All existing formats (JSON, hex, SS58 addresses) continue to work unchanged.

### Patch Changes

- 8e4fcf8: Fix Binary values (e.g. token `symbol` and `name` fields) displaying as `{}` in query and transaction output. Binary instances now render as human-readable text when valid UTF-8, or as hex strings otherwise.

## 0.8.1

### Patch Changes

- 84761a3: Remove `chain: <name>` output from `query` and `const` commands. Previously, both commands printed the chain name to stdout (in pretty mode) or stderr (in JSON mode) before the result. This broke piping to `jq` and other tools that expect clean, parseable output. Stdout now contains only the query/constant result, making `dot query ... | jq` and `dot const ... | jq` work out of the box.

## 0.8.0

### Minor Changes

- f045a20: Add chain-prefix syntax for `query`, `const`, `tx`, and `inspect` commands. Instead of using `--chain`, you can now prefix the target with the chain name: `dot query kusama.System.Account <addr>`, `dot const kusama.Balances.ExistentialDeposit`, `dot inspect kusama.System`. The `--chain` flag and default chain remain as fallbacks. If both a chain prefix and `--chain` flag are provided, the CLI errors with a clear message.

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
