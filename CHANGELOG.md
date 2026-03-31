# polkadot-cli

## 1.12.0

### Minor Changes

- 1ff250b: Add `dot sign` command for signing arbitrary messages with account keypairs. Accepts inline text, hex bytes (`0x`-prefixed), file contents (`--file`), or stdin (`--stdin`). Output shows the crypto type, message bytes in hex, raw signature, and a `Sr25519(0x...)` enum value directly usable as a `MultiSignature` argument in transaction calls. Supports `--output json` for structured output. Supports dev accounts, stored accounts, and env-backed accounts via `--from`. Signature type is configurable with `--type` (default: sr25519).
- cb7c058: Add `dot verifiable` command to derive Bandersnatch member keys from account mnemonics using the `verifiablejs` WASM library. Supports unkeyed (lite person) and keyed derivation via `--context` flag (e.g. `--context candidate` for full person). Derived keys are saved to the account store and displayed in `account inspect` and `account create` output.
- 9240771: Remove `--limit` option from map queries.

  The `--limit` flag only truncated displayed results after all entries were already fetched from the chain, providing no performance benefit. The default limit of 100 silently hid results, which could confuse users who didn't realize their output was truncated.

  All map query results are now returned in full. Users who want to limit output can pipe through standard Unix tools (e.g. `| head -n 10` or `| jq '.[0:5]'`).

## 1.11.0

### Minor Changes

- 130d737: Add comma-separated syntax for `Vec<T>` parameters.

  Array arguments (like `Utility.batchAll` calls) can now be passed as comma-separated values instead of requiring a JSON array string. This makes composing batch calls from individually encoded calls much more ergonomic:

  ```bash
  A=$(dot tx Balances.transfer_keep_alive 5FHn... 1DOT --encode)
  B=$(dot tx System.remark 0xdead --encode)
  dot tx Utility.batchAll $A,$B --from alice
  ```

  - Works for any `Vec<T>` parameter (not just batch calls)
  - `Vec<u8>` byte arrays are unaffected (still treated as binary)
  - JSON array syntax `'[...]'` and file-based input continue to work as before

## 1.10.0

### Minor Changes

- 2f6aad6: Add transaction options: `--nonce`, `--tip`, `--mortality`, and `--at` flags for `dot tx`.

  - `--nonce <n>` overrides the auto-detected nonce, enabling rapid-fire submission of multiple extrinsics without waiting for each to finalize
  - `--tip <amount>` adds a priority tip (in planck) to the transaction pool
  - `--mortality <spec>` controls transaction lifetime: `immortal` for no expiry, or a period number (minimum 4) for a custom mortality window
  - `--at <block>` specifies which block state to validate against (`best`, `finalized`, or a block hash)
  - All options are passed through to polkadot-api's `TxOptions` and work with `--dry-run`, file-based commands, and all wait levels

## 1.9.0

### Minor Changes

- dfd359d: Support partial key queries for multi-key storage maps (NMaps). You can now pass fewer key arguments than expected to retrieve all entries matching that prefix via `getEntries()`, without requiring `--dump`. For example, querying a 2-key map with only the first key returns all entries under that prefix.

### Patch Changes

- 115b751: Improve best-effort hex-to-text conversion for Binary values.

  Binary fields that contain control characters (C0/C1), DEL, or Private Use Area code points now correctly fall back to hex display instead of rendering as garbled text. This fixes storage keys and other identifiers that start with a text-based prefix but contain binary hash data after it.

- f0516ef: Add npm version badge to README

## 1.8.1

### Patch Changes

- 65d540b: Fix file-based command invocation when running under Node.js and preserve hex variable values.

  - Replace Bun-specific APIs (`Bun.file`, `Bun.stdin`) with Node.js-compatible equivalents (`node:fs/promises`, `process.stdin`) so `dot ./file.yaml` works when installed from npm
  - Preserve hex `--var` values (e.g. `--var CALL=0xdeadbeef`) as strings in YAML files — previously YAML's core schema silently converted `0x…` to integers, dropping leading zeros and breaking encoded call data
  - Improve the "undefined variable" error message with a structured, multiline format listing all resolution options

## 1.8.0

### Minor Changes

- 55cff47: Add `dot parachain` command to derive sovereign account addresses for parachains.

  - `dot parachain 1000` shows both child and sibling sovereign accounts for a given parachain ID
  - Child accounts (`"para"` prefix) represent a parachain on the relay chain
  - Sibling accounts (`"sibl"` prefix) represent a parachain on another parachain
  - `--type child` or `--type sibling` to show only one type
  - `--prefix <N>` to control the SS58 address encoding (default: 42)
  - `--output json` for pipe-safe structured output
  - Runs offline — no chain connection required
  - No new dependencies — uses existing SS58 encoding utilities

- f637890: Add `--yaml` and `--json` flags to decode transaction call data into file-compatible formats.

  - `dot tx.0x1f0003... --yaml` decodes a raw hex call to YAML
  - `dot tx.System.remark 0xdead --json` encodes then outputs as JSON
  - Output matches the file input format, enabling a round-trip workflow: encode a call, decode to YAML/JSON, tweak parameters, re-execute via file input
  - Works offline from cached metadata, does not require `--from`
  - Mutually exclusive with `--encode` and `--dry-run`

## 1.7.0

### Minor Changes

- 49f8f16: Add file-based command input: run any `dot` command from a YAML or JSON file.

  - `dot ./transfer.yaml --from alice --dry-run` reads a structured file and routes to the appropriate handler
  - Supports all categories: `tx`, `query`, `const`, `apis`
  - Shell-style variable substitution with `${VAR}` and `${VAR:-default}` syntax
  - Variables resolved from `--var KEY=VALUE` flags, environment variables, or a `vars:` section in the file
  - Both `.yaml`/`.yml` and `.json` file formats supported
  - All existing CLI flags (`--from`, `--dry-run`, `--encode`, `--chain`, etc.) work with file input

### Patch Changes

- 93c13e2: Add XCM transfer examples to documentation: teleport DOT and reserve transfer USDC from polkadot-asset-hub.

  - Teleport DOT example: Asset Hub to relay chain via `PolkadotXcm.limited_teleport_assets`
  - Reserve transfer USDC (asset 1337) example: Asset Hub to Hydration (parachain 2034) via `PolkadotXcm.limited_reserve_transfer_assets`
  - Both YAML and JSON formats shown
  - Examples verified via integration tests against relay chain metadata

## 1.6.1

### Patch Changes

- 8300ca7: Fix space-separated arguments not being recognized as pallet/item segments when used with `--chain` flag or category-only dot-paths.

  - `dot --chain polkadot api Core` now correctly lists Core methods (previously showed global API list)
  - `dot query System` now lists System storage items (equivalent to `dot query.System`)
  - `dot events Balances Transfer` now shows Transfer event detail (equivalent to `dot events.Balances.Transfer`)
  - Applies to all categories: query, tx, const, events, errors, apis

## 1.6.0

### Minor Changes

- cae50f3: Add `--all` flag to `dot chain update` to re-fetch metadata for all configured chains in parallel.

  - `dot chain update --all` updates all chains concurrently
  - Shows a summary with check/cross marks for each chain
  - Failures don't block other chains (uses `Promise.allSettled`)
  - Exits with non-zero if any chain fails

- 7064511: Add runtime API calls as new `apis` category. Browse and call Substrate runtime APIs (e.g. `Core.version`, `AccountNonceApi.account_nonce`) directly from the CLI.

  - `dot apis` lists all runtime APIs with method counts
  - `dot apis.Core` lists methods in a specific API with signatures
  - `dot apis.Core.version` calls a runtime API method
  - Chain prefix support: `dot polkadot.apis.Core.version`
  - `--help` support: `dot apis.Core.version --help`
  - Shell completions for API names and method names
  - Aliases: `api` and `apis` both work
  - Metadata fetching now requests v15 metadata first (required for runtime API info), falling back to v14
  - Shows a helpful hint when cached metadata is v14 and does not include runtime APIs

### Patch Changes

- 4c7dbaa: Add feature list to README and docs landing page

## 1.5.0

### Minor Changes

- 142329f: Add `--wait` / `-w` flag to control how long `tx` commands wait before returning.

  By default, `dot tx` waits for finalization (~30s on Polkadot). The new `--wait` flag lets you choose an earlier resolution point:

  ```
  # Return as soon as the tx is broadcast (fastest)
  dot tx.System.remark 0xdead --from alice --wait broadcast

  # Return when included in a best block (medium)
  dot tx.System.remark 0xdead --from alice -w best-block
  dot tx.System.remark 0xdead --from alice -w best   # alias

  # Wait for finalization (default, unchanged behavior)
  dot tx.System.remark 0xdead --from alice --wait finalized
  dot tx.System.remark 0xdead --from alice            # same
  ```

  The output adapts to the wait level:

  - **broadcast**: shows tx hash and broadcast status, no events or explorer links
  - **best-block**: shows events and explorer links with a "(best block, not yet finalized)" hint
  - **finalized**: unchanged behavior with full events and explorer links

  Shell completions for `--wait` / `-w` values are included.

- 0df428d: Sort all CLI output alphabetically. Pallets, storage items, constants, calls, events, and errors are now listed in alphabetical order across all commands (inspect, query, tx, const, events, errors) and shell completions, making it easier to find specific items.

## 1.4.0

### Minor Changes

- 080d2d0: Require `--dump` flag for keyless map queries to prevent accidentally fetching all entries.

  Running `dot query.System.Account` (a map query without a key) now shows help and usage info instead of fetching every entry via `getEntries()`. This protects users from accidentally triggering slow, expensive full-map dumps on live chains with millions of entries.

  To explicitly fetch all entries, pass `--dump`:

  ```
  dot query.System.Account --dump
  dot query.System.Account --dump --limit 10
  ```

  Querying a specific key still works as before:

  ```
  dot query.System.Account 5GrwvaEF...
  ```

### Patch Changes

- 000ab29: Fix enum variant names not recognized as storage query keys.

  Enum variants whose metadata type is wrapped in `lookupEntry` indirection (e.g. `{ type: "lookupEntry", value: { type: "void" } }`) were not resolved before checking for void, causing them to fall through as raw strings. This produced a cryptic "Incompatible runtime entry" error when querying storage maps keyed by such enums (e.g. `ChunksManager.Chunks R2e9 1`). The same variants already worked in `--encode` via the shorthand path, which correctly resolved `lookupEntry` first.

- e798641: Add `emulate -L zsh` to zsh completion function to prevent user shell options from interfering with completion logic.

## 1.3.0

### Minor Changes

- a155161: Add shell completion support for zsh, bash, and fish.

  Run `dot completions zsh`, `dot completions bash`, or `dot completions fish` to generate a shell completion script. Tab-complete subcommands, chain names, pallet names, and item names from cached metadata — all offline with no network calls.

  Completions are context-aware: `query.` completes pallets with storage items, `tx.` completes pallets with calls, `events.` and `errors.` filter accordingly. Chain prefix paths (`polkadot.query.System.`) and option values (`--chain`, `--from`, `--output`) are also supported.

## 1.2.0

### Minor Changes

- 4acef22: Add watch-only accounts and named address resolution.

  Accounts can now be added without secrets using `dot account add <name> <address>`, storing just the public key as a watch-only entry. Named accounts (both watch-only and keyed) resolve everywhere an AccountId32 is expected — in `dot tx` arguments, `dot query` keys, and MultiAddress auto-wrapping. For example: `dot tx Balances.transferKeepAlive treasury 1000 --from alice` or `dot query System.Account treasury`.

  Watch-only accounts show a `(watch-only)` badge in `dot account list`, cannot be used with `--from` (signing), and cannot be used as `derive` sources. The `add` subcommand is now context-sensitive: bare `add <name> <address>` creates a watch-only entry, while `add --secret` or `add --env` imports a keyed account as before.

### Patch Changes

- d2f64eb: Fix release workflow timeout by parallelizing sequential `runCli` calls in account import test.

## 1.1.1

### Patch Changes

- f14bef7: Fix "Missing WebSocket class" error when running in sandboxed environments (e.g. LLM/MCP runtimes, plain Node.js without native WebSocket). The WS provider now explicitly uses the `ws` package instead of relying on `globalThis.WebSocket`.

## 1.1.0

### Minor Changes

- b81413f: Add item-level `--help` for fully-qualified dot-path commands. Running `dot tx.System.remark --help`, `dot query.System.Account --help`, `dot const.Balances.ExistentialDeposit --help`, etc. now shows metadata detail (args, types, docs) and category-specific usage hints — all offline without connecting to the chain. For `tx` commands, omitting `--from` and `--encode` now shows this same help output instead of a terse error.

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
