[![npm version](https://img.shields.io/npm/v/polkadot-cli)](https://www.npmjs.com/package/polkadot-cli)
[![codecov](https://codecov.io/gh/peetzweg/polkadot-cli/branch/main/graph/badge.svg)](https://codecov.io/gh/peetzweg/polkadot-cli)

# polkadot-cli

A command-line tool for interacting with Polkadot-ecosystem chains. Manage chains and accounts, query storage, look up constants, inspect metadata, submit extrinsics, and compute hashes — all from your terminal.

Ships with Polkadot and all system parachains preconfigured with multiple fallback RPC endpoints. Add any Substrate-based chain by pointing to its RPC endpoint(s).

## Features

- ✅ Same syntax as [polkadot-api](https://papi.how) (PAPI)
- ✅ Chain name prefix — `dot polkadot.query.System.Number`
- ✅ zsh, bash, and fish autocompletion
- ✅ Exposes all on-chain metadata documentation
- ✅ Encode, dry-run, and submit extrinsics
- ✅ Support for custom signed extensions — and a `dot <chain>.extensions` inspector to discover them
- ✅ Built with agent use in mind — structured JSON output on every command (`--json`)
- ✅ Fuzzy matching with typo suggestions
- ✅ Account management — BIP39 mnemonics, derivation paths, env-backed secrets, watch-only, dev accounts
- ✅ Named address resolution across all commands
- ✅ Runtime API calls — `dot polkadot.apis.Core.version`
- ✅ Chain topology — relay/parachain hierarchy with tree display and auto-detection
- ✅ Batteries included — all system parachains and testnets already setup to be used
- ✅ File-based commands — run any command from a YAML/JSON file with variable substitution
- ✅ Parachain sovereign accounts — derive child and sibling addresses from a parachain ID
- ✅ Message signing — sign arbitrary bytes with account keypairs for use as `MultiSignature` arguments
- ✅ Unsigned/authorized transactions — submit governance-authorized calls without a signer (`--unsigned`)
- ✅ Non-native fee payment — pay tx fees in any asset the chain accepts via `--asset` (asset-hub-style chains)
- ✅ Bandersnatch member keys — derive Ring VRF member keys from mnemonics for on-chain member sets
- ✅ Export/import — portable chain and account configuration for backup, sharing, and CI bootstrapping

### Preconfigured chains

| Network | Chain |
|---------|-------|
| Polkadot | `polkadot` (relay) |
| | `polkadot-asset-hub` |
| | `polkadot-bridge-hub` |
| | `polkadot-collectives` |
| | `polkadot-coretime` |
| | `polkadot-people` |
| Paseo (testnet) | `paseo` (relay) |
| | `paseo-asset-hub` |
| | `paseo-bridge-hub` |
| | `paseo-collectives` |
| | `paseo-coretime` |
| | `paseo-people` |

Each chain ships with multiple RPC endpoints from decentralized infrastructure providers (IBP, Dotters, Dwellir, and others). The CLI automatically falls back to the next endpoint if the primary is unreachable.

## Install

```bash
npm install -g polkadot-cli@latest
```

This installs the `dot` command globally.

## Usage

### Manage chains

```bash
# Show chain help
dot chain               # shows available actions
dot chains              # shorthand, same as above

# Add a chain (single RPC)
dot chain add kusama --rpc wss://kusama-rpc.polkadot.io

# Add a chain with fallback RPCs (repeat --rpc for each endpoint)
dot chain add kusama --rpc wss://kusama-rpc.polkadot.io --rpc wss://kusama-rpc.dwellir.com

# Add a parachain under a relay (auto-detects parachain ID)
dot chain add local-asset-hub --rpc ws://localhost:9945 --relay local-relay

# Add a parachain with explicit parachain ID
dot chain add my-para --rpc wss://rpc.example.com --relay polkadot --parachain-id 2000

# List configured chains (shows relay/parachain hierarchy)
dot chain list

# Re-fetch metadata after a runtime upgrade
dot chain update polkadot   # updates a specific chain
dot chain update --all      # updates all configured chains in parallel

# Remove a chain (only user-added chains can be removed)
dot chain remove kusama
```

#### Chain topology

`dot chain list` displays chains as a tree, grouping parachains under their parent relay:

```
Configured Chains

  polkadot  wss://polkadot.ibp.network
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

All built-in system parachains are preconfigured with their relay chain and parachain ID. When adding a custom parachain with `--relay`, the CLI auto-detects the parachain ID from on-chain `ParachainInfo` storage. Use `--parachain-id` to set it explicitly if auto-detection is not available.

Removing a relay chain that has parachains prints a warning listing the orphaned chains. The parachains remain in the config and can be re-associated later.

#### Selecting a chain

Every chain-consuming command must specify a chain explicitly — either with the global `--chain <name>` flag or with a dotpath chain prefix. There is no hidden default; running a command without a chain errors out with a message listing the configured chains.

```bash
# Via --chain flag
dot query.System.Number --chain polkadot

# Via dotpath chain prefix
dot polkadot.query.System.Number

# Both at once errors
dot polkadot.query.System.Number --chain polkadot  # ✗ errors
```

Chain names are case-insensitive (`Polkadot.query.System.Number` works the same).

#### Export/import chain configuration

Export and import chain configurations for backup, sharing across machines, or team collaboration. Metadata is not included — re-fetch with `dot chain update --all` after importing.

```bash
# Export custom chains to stdout (pipe-friendly JSON)
dot chain export

# Export all chains including built-ins
dot chain export --all

# Export specific chains
dot chain export my-relay my-para

# Export to a file
dot chain export --all --file my-chains.json

# Import from a file
dot chain import my-chains.json

# Preview without applying
dot chain import my-chains.json --dry-run

# Overwrite existing chains
dot chain import my-chains.json --overwrite

# Pipe between machines
ssh remote-dev "dot chain export" | dot chain import -
```

By default, `export` only includes user-added chains and built-ins with modified RPCs. Use `--all` to include everything. Import skips existing chains unless `--overwrite` is passed, and validates relay references with warnings for missing relays.

### Manage accounts

Dev accounts (Alice, Bob, Charlie, Dave, Eve, Ferdie) are always available for testnets. Create or import your own accounts for any chain.

> **Security warning:** Account secrets (mnemonics and seeds) are currently stored **unencrypted** in `~/.polkadot/accounts.json`. Do not use this for high-value accounts on mainnet. Encrypted storage is planned for a future release. Use `--env` to keep secrets off disk entirely.

```bash
# Show account help
dot account             # shows available actions
dot accounts            # shorthand, same as above

# List all accounts (dev + stored)
dot account list

# Add a watch-only address (no secret — for use as tx recipient or query target)
dot account add treasury 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
dot account add council 0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d

# Create a new account (generates a mnemonic)
dot account create my-validator

# Create with a derivation path
dot account create my-staking --path //staking

# Import from a BIP39 mnemonic
dot account import treasury --secret "word1 word2 ... word12"

# Import with a derivation path
dot account import hot-wallet --secret "word1 word2 ... word12" --path //hot

# Import an env-var-backed account (secret stays off disk)
dot account import ci-signer --env MY_SECRET

# Derive a child account from an existing one
dot account derive treasury treasury-staking --path //staking

# Use it — the env var is read at signing time
MY_SECRET="word1 word2 ..." dot tx.System.remark 0xdead --from ci-signer --chain polkadot

# Remove one or more accounts
dot account remove my-validator
dot account delete my-validator stale-key

# Export accounts (secrets redacted by default)
dot account export
dot account export --include-secrets --file backup.json
dot account export --watch-only

# Batch-import accounts from a file
dot account import --file team-accounts.json
dot account import --file accounts.json --dry-run
dot account import --file accounts.json --overwrite

# Inspect an account — show public key and SS58 address
dot account inspect alice
dot account alice                    # shorthand (same as inspect)
dot account inspect 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
dot account inspect 0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d
dot account inspect alice --prefix 0         # Polkadot mainnet prefix
dot account inspect alice --json             # JSON output
```

#### Watch-only accounts

Add named addresses without secrets — useful for saving frequently-used recipients, multisig members, or query targets:

```bash
dot account add treasury 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
dot account add council 0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d
```

Watch-only accounts appear in `dot account list` with a `(watch-only)` badge and can be inspected and removed like any other account. They cannot be used with `--from` (signing) or as a source for `derive`.

The `add` subcommand is context-sensitive: bare `add <name> <address>` creates a watch-only entry, while `add --secret` or `add --env` imports a keyed account (same as `import`).

#### Named address resolution

Named accounts (both watch-only and keyed) resolve automatically everywhere an AccountId32 or MultiAddress is expected — in `dot tx` arguments and `dot query` keys:

```bash
# Use a named account as transfer recipient
dot tx.Balances.transferKeepAlive treasury 1000000000000 --from alice --chain polkadot

# Query by account name
dot polkadot.query.System.Account treasury

# Dev accounts also resolve
dot tx.Balances.transferKeepAlive bob 1000000000000 --from alice --chain polkadot
```

Resolution order: dev account name > stored account name > SS58 address > hex public key. If the input doesn't match any, the CLI shows an error listing all available account names alphabetically, one per line. When the input is close to an existing name, a "Did you mean?" suggestion is included:

```
Error: Unknown account or address "people-sudo-signer".
  Did you mean: people-paseo-sudo?
  Available accounts:
    - alice
    - bob
    - charlie
    - people-paseo-sudo
    - ...
```

#### Inspect accounts

Convert between SS58 addresses, hex public keys, and account names. Accepts any of:

- **Dev account name** (`alice`, `bob`, etc.) — resolves to public key and SS58
- **Stored account name** — looks up the public key from the accounts file
- **SS58 address** — decodes to the underlying public key
- **Hex public key** (`0x` + 64 hex chars) — encodes to SS58

```bash
dot account inspect alice
dot account alice                    # shorthand — unknown subcommands fall through to inspect

dot account inspect 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
dot account inspect 0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d
```

Use `--prefix` to encode the SS58 address with a specific network prefix (default: 42):

```bash
dot account inspect alice --prefix 0     # Polkadot mainnet (prefix 0, starts with '1')
dot account inspect alice --prefix 2     # Kusama (prefix 2)
```

JSON output:

```bash
dot account inspect alice --json
# {"publicKey":"0xd435...a27d","ss58":"5Grw...utQY","prefix":42,"name":"Alice"}
```

#### Env-var-backed accounts

For CI/CD and security-conscious workflows, store a reference to an environment variable instead of the secret itself:

```bash
dot account import ci-signer --env MY_SECRET
```

`--secret` and `--env` are mutually exclusive. `add` is an alias for `import`.

The secret is never written to disk. At signing time, the CLI reads `$MY_SECRET` and derives the keypair. If the variable is not set, the CLI errors with a clear message. `account list` shows an `(env: MY_SECRET)` badge and resolves the address live when the variable is available.

#### Derivation paths

Use `--path` with `create`, `import`, or the `derive` action to derive child keys from the same secret. Different paths produce different keypairs, enabling key separation (e.g. staking vs. governance) without managing multiple mnemonics.

```bash
# Create with a derivation path
dot account create my-staking --path //staking

# Multi-segment path (hard + soft junctions)
dot account create multi --path //polkadot//0/wallet

# Import with a path
dot account import hot --secret "word1 word2 ..." --path //hot

# Derive a child from an existing account
dot account derive treasury treasury-staking --path //staking
```

`derive` copies the source account's secret and applies the given path. It requires both a source name, a new name, and `--path`. Works with env-backed accounts too — the derived account shares the same env var reference.

`account list` shows the derivation path next to the account name:

```
  treasury-staking (//staking)  5FHneW46...
  ci-signer (//ci) (env: MY_SECRET)  5EPCUjPx...
```

**Supported secret formats for import:**

| Format | Example | Status |
|--------|---------|--------|
| BIP39 mnemonic (12/24 words) | `"abandon abandon ... about"` | Supported |
| Hex seed (`0x` + 64 hex chars) | `0xabcdef0123...` | Not supported via CLI (see below) |

**Known limitation:** Hex seed import (`--secret 0x...`) does not work from the command line. The CLI argument parser (`cac`) interprets `0x`-prefixed values as JavaScript numbers, which loses precision for 32-byte seeds. Use a BIP39 mnemonic instead. If you need to import a raw seed programmatically, write it directly to `~/.polkadot/accounts.json`.

#### Export/import accounts

Export and import accounts for backup, sharing, or bootstrapping CI environments. Secrets are **redacted by default** — safe to share or commit.

```bash
# Export accounts (secrets redacted by default)
dot account export

# Export specific accounts
dot account export treasury my-validator

# Include secrets (explicit opt-in, prints warning)
dot account export --include-secrets --file backup.json

# Export only watch-only accounts (always safe)
dot account export --watch-only

# Batch-import accounts from a file
dot account import --file team-accounts.json

# Preview without applying
dot account import --file accounts.json --dry-run

# Overwrite existing accounts
dot account import --file accounts.json --overwrite

# Pipe from another machine
ssh remote-dev "dot account export --watch-only" | dot account import --file /dev/stdin
```

Security: default export replaces mnemonic/seed with `"<redacted>"`. `--include-secrets` is required for actual secrets. Env-backed accounts export the variable *name* (e.g. `{"env": "MY_SECRET"}`), never the value. Redacted accounts import as watch-only (public key preserved, no signing capability). The existing single-account `import` (`--secret`/`--env`) is unchanged — batch import uses `--file` to distinguish.

### Chain prefix

Instead of the `--chain` flag, you can prefix the dot-path with the chain name. The prefix becomes the first segment of the dot-path:

```bash
dot polkadot.query.System.Account 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
dot polkadot.const.Balances.ExistentialDeposit
dot polkadot.tx.Balances.transferKeepAlive 5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty 1000000000000 --from alice
dot inspect polkadot.System            # for `inspect`, the prefix is the first arg
dot inspect polkadot.System.Account
```

Chain names are case-insensitive — `Polkadot.query.System.Account`, `POLKADOT.query.System.Account`, and `polkadot.query.System.Account` all resolve the same way. The same applies to `--chain Polkadot`.

Every invocation must specify a chain explicitly: either via a dotpath prefix (as above) or via `--chain <name>`. If both are provided, the CLI errors.

### Space-separated syntax

The `Pallet` and `Item` segments can be passed as separate arguments instead of dot-joined. These pairs are equivalent:

```bash
# Dot notation vs fully space-separated — these are identical:
dot polkadot.query.System                 # dot notation
dot query System --chain polkadot         # space-separated

dot polkadot.events.Balances.Transfer
dot events Balances Transfer --chain polkadot

dot polkadot.apis.Core
dot apis Core --chain polkadot
```

This works for all categories (`query`, `tx`, `const`, `events`, `errors`, `apis`, `extensions`). When passing positional method arguments, keep `Pallet` and `Item` either fully dot-joined (`query.System.Account 5Grw...`) or fully space-separated (`query System Account 5Grw...`) — mixing the two (`query System.Account 5Grw...`) does not work because the second arg gets parsed as a pallet name.

### Query storage

```bash
# Plain storage value
dot polkadot.query.System.Number

# Map entry by key
dot polkadot.query.System.Account 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY

# Map without key — shows help/usage (use --dump to fetch all entries)
dot polkadot.query.System.Account

# Dump all map entries (requires --dump)
dot polkadot.query.System.Account --dump

# Pipe-safe — stdout is clean data, progress messages go to stderr
dot polkadot.query.System.Account --dump | jq '.[0].value.data.free'
dot polkadot.query.System.Number --json | jq '.+1'

# --chain flag is equivalent to the dotpath prefix
dot query.System.Account 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY --chain polkadot
```

#### Partial key queries

For storage maps with multiple keys (NMaps), you can provide fewer keys than
expected to retrieve all entries matching that prefix. This uses the chain's
prefix-based iteration and does not require `--dump`.

```bash
# Full key — returns a single value
dot polkadot.query.Staking.ErasStakers 100 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY

# Partial key — returns all entries matching the first key
dot polkadot.query.Staking.ErasStakers 100

# No keys — requires --dump (safety net for large maps)
dot polkadot.query.Staking.ErasStakers --dump
```

#### Output formatting

Query results automatically convert on-chain types for readability:

- **BigInt** values (e.g. balances) render as decimal strings
- **Binary** fields (e.g. token `name`, `symbol`) render as text when the value contains only printable characters, or as `0x`-prefixed hex otherwise (values containing control characters, Private Use Area code points, or invalid UTF-8 sequences always fall back to hex)
- **Uint8Array** values render as `0x`-prefixed hex

```bash
# Token metadata — symbol and name display as text, not {}
dot paseo-asset-hub.query.Assets.Metadata 50000413
# { "deposit": "6693666000", "name": "Paseo Token", "symbol": "PAS", ... }
```

### Look up constants

```bash
dot polkadot.const.Balances.ExistentialDeposit
dot polkadot.const.System.SS58Prefix

# --chain flag is equivalent
dot const.Balances.ExistentialDeposit --chain polkadot

# Pipe-safe — stdout is clean JSON, progress messages go to stderr
dot polkadot.const.Balances.ExistentialDeposit --json | jq
```

### Inspect metadata

Works offline from cached metadata after the first fetch. The chain is required: pass it with `--chain` or as a prefix on the inspect target (e.g. `dot inspect polkadot.System`).

```bash
# List all pallets (shows storage, constants, calls, events, and errors counts)
dot inspect --chain polkadot

# List a pallet's storage items, constants, calls, events, and errors
dot inspect System --chain polkadot

# Detailed type info for a specific storage item or constant
dot inspect System.Account --chain polkadot

# Call detail — shows argument signature and docs
dot inspect Balances.transfer_allow_death --chain polkadot

# Event detail — shows field signature and docs
dot inspect Balances.Transfer --chain polkadot

# Error detail — shows docs
dot inspect Balances.InsufficientBalance --chain polkadot

# Chain prefix on the inspect target works too (note: `dot polkadot.inspect.X` does NOT — use either form below)
dot inspect polkadot.System
dot inspect polkadot.System.Account
```

All listings — pallets, storage items, constants, calls, events, and errors — are sorted alphabetically, making it easy to find a specific item at a glance.

The pallet listing view shows type information inline so you can understand item shapes at a glance:

- **Storage**: key/value types with `[map]` tag for map items (e.g. `Account: AccountId32 → { nonce: u32, ... }    [map]`)
- **Constants**: the constant's type (e.g. `ExistentialDeposit: u128`)
- **Calls**: full argument signature (e.g. `transfer_allow_death(dest: enum(5 variants), value: Compact<u128>)`)
- **Events**: field signature (e.g. `Transfer(from: AccountId32, to: AccountId32, amount: u128)`)
- **Errors**: name and documentation (e.g. `InsufficientBalance`)

Documentation from the runtime metadata is shown on an indented line below each item. The detail view (`dot inspect Balances.transfer_allow_death`) shows the full argument signature and complete documentation text. Use call inspection to discover argument names, types, and docs before constructing `dot tx` commands.

### Runtime APIs

Browse and call Substrate runtime APIs. These are top-level APIs exposed by the runtime (e.g. `Core`, `AccountNonceApi`, `TransactionPaymentApi`), accessed as `dot <chain>.apis.ApiName.method`.

```bash
# List all runtime APIs with method counts
dot polkadot.apis

# List methods in a specific API (with signatures)
dot polkadot.apis.Core

# Call a runtime API method
dot polkadot.apis.Core.version

# --chain flag is equivalent
dot apis.Core.version --chain polkadot

# Show method signature and docs (chain still required to load metadata)
dot apis.Core.version --chain polkadot --help
```

`api` is an alias for `apis`.

Runtime API info requires v15 metadata. If `dot <chain>.apis` shows 0 APIs, update the cached metadata:

```bash
dot chain update polkadot   # specific chain
dot chain update --all      # all configured chains
```

#### Argument formats

Runtime API arguments accept the same shorthand as `dot tx` arguments:

| Type | Pass as | Example |
|------|---------|---------|
| Integers (`u8` … `u32`, `i8` … `i32`) | decimal | `0`, `42` |
| Big integers (`u64`, `u128`, `u256`, `i64` …) | decimal | `1000000000000` |
| `bool` | `true` / `false` | `true` |
| `AccountId32` | dev name, stored account, SS58, or `0x` + 64 hex pubkey | `alice`, `5GrwvaEF…` |
| `Vec<u8>` (unsized bytes) | `0x…` hex or text | `0xdeadbeef`, `hello` |
| `[u8; N]` (sized bytes, e.g. `H160`/`H256`/raw `AccountId`) | `0x` + exactly `2 * N` hex chars (recommended), or text | `0x970951a12f975e6762482aca81e57d5a2a4e73f4` |
| `Option<T>` | `null` (recommended), `none`, `undefined` — or a `T` value for `Some(value)` | `null` |
| `Vec<T>` (non-byte) | JSON array or comma-separated | `[1,2,3]`, `1,2,3` |
| Structs / nested enums | JSON | `{"type":"X1","value":{…}}` |

For sized byte arrays (`[u8; N]`) — common for Ethereum-style addresses (`H160`, `[u8; 20]`), 32-byte hashes (`H256`), and raw `AccountId32` bytes — pass a `0x`-prefixed hex string. Example: a contract call against the `pallet-revive` runtime API:

```bash
ALICE=5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
CONTRACT=0x970951a12f975e6762482aca81e57d5a2a4e73f4         # H160, [u8; 20]
CALLDATA=$(cast calldata "set(uint256)" 42)

dot paseo-asset-hub.apis.ReviveApi.call \
  "$ALICE" "$CONTRACT" 0 null null "$CALLDATA"
#   ^ origin   ^ dest    ^ value ^ gas_limit (Option, none) ^ deposit (Option, none) ^ input_data (Vec<u8>)
```

##### Passing `Option<T>`

Absent options (`None`) can be written three ways, all equivalent:

```bash
dot paseo-asset-hub.apis.ReviveApi.call "$ALICE" "$CONTRACT" 0 null       null       "$CALLDATA"
dot paseo-asset-hub.apis.ReviveApi.call "$ALICE" "$CONTRACT" 0 none       none       "$CALLDATA"
dot paseo-asset-hub.apis.ReviveApi.call "$ALICE" "$CONTRACT" 0 undefined  undefined  "$CALLDATA"
```

`null` is the **recommended** form — it matches JSON / YAML semantics, so args read identically on the CLI and inside [file-based command](#file-based-commands) YAML/JSON inputs.

A present option (`Some(value)`) is just the value itself — no wrapping:

```bash
# gas_limit = Some({ ref_time: 1_000_000, proof_size: 100_000 })
dot paseo-asset-hub.apis.ReviveApi.call "$ALICE" "$CONTRACT" 0 \
  '{"ref_time":1000000,"proof_size":100000}' \
  null \
  "$CALLDATA"
```

Notes:
- The `null` / `none` / `undefined` literals are case-sensitive (lowercase only).
- There is no `Some(value)` prefix — bare values are already treated as `Some`.

Use `dot <chain>.apis.<ApiName>.<method> --help` to see the exact argument signature for any method.

### Focused metadata listings

Each category supports partial dot-paths for browsing metadata. Category-only invocations list pallets (or APIs); pallet-level invocations list items; item-level invocations show detail. Singular and plural aliases work: `event` = `events`, `error` = `errors`, `api` = `apis`, `consts` = `constants` = `const`.

```bash
# List pallets with calls (and the calls themselves)
dot polkadot.tx                                 # pallets with calls
dot polkadot.tx.Balances                        # calls with arg signatures
dot polkadot.tx.Balances.transfer_allow_death   # call detail (or use --help)

# Events
dot polkadot.events                             # pallets with events
dot polkadot.events.Balances                    # events with field signatures
dot polkadot.events.Balances.Transfer           # event detail

# Errors
dot polkadot.errors                             # pallets with errors
dot polkadot.errors.Balances                    # errors with docs
dot polkadot.errors.Balances.InsufficientBalance

# Storage (via the query category)
dot polkadot.query                              # pallets with storage items
dot polkadot.query.System                       # storage items with types
dot polkadot.query.System.Account               # storage help (use --dump for all entries)

# Constants
dot polkadot.const                              # pallets with constants
dot polkadot.const.Balances                     # list constants (offline)
dot polkadot.const.Balances.ExistentialDeposit  # look up value (connects to chain)

# Runtime APIs
dot polkadot.apis                               # all runtime APIs
dot polkadot.apis.Core                          # methods in Core

# Transaction extensions (flat — no pallet sub-level)
dot polkadot.extensions                         # all transaction extensions
dot polkadot.extensions.CheckMortality          # extension detail
```

`--chain <name>` works as an alternative to the prefix in every form (e.g. `dot tx.Balances --chain polkadot`). To browse pallets across all categories at once, use `dot inspect` (see [Inspect metadata](#inspect-metadata)).

### Transaction extensions

List the transaction extensions (also known as signed extensions) a chain declares in its runtime, with types and a marker indicating whether `polkadot-api` handles the extension automatically or whether you need to provide a value via `--ext` when building a transaction (see [Submit extrinsics](#submit-extrinsics)).

```bash
# List all transaction extensions on a chain
dot polkadot.extensions

# Detail view for a single extension
dot polkadot.extensions.CheckMortality

# --chain flag form is equivalent
dot extensions.ChargeTransactionPayment --chain polkadot

# Space-separated syntax also works
dot extensions CheckMortality --chain polkadot

# Structured output for scripts
dot polkadot.extensions --json
```

`extension` and `ext` are aliases for `extensions`. Shell completion suggests identifiers after `dot polkadot.extensions.<Tab>`.

The list view tags each entry:

- `[builtin]` — `polkadot-api` fills this in for you (e.g. `CheckMortality`, `CheckNonce`, `ChargeTransactionPayment`, `CheckMetadataHash`)
- `[custom]` — you must provide a value with `--ext` when signing, for example `--ext '{"<Identifier>":{"value":<v>}}'`

The detail view shows the extension's value type, its `additionalSigned` type, and a ready-to-adapt `--ext` snippet for custom extensions. Use this to discover what `--ext` payload a chain expects before submitting a `dot tx` command.

### Submit extrinsics

Build, sign, and submit transactions. Pass a `Pallet.Call` with arguments, or a raw SCALE-encoded call hex (e.g. from a multisig proposal or governance). Both forms display a decoded human-readable representation of the call.

```bash
# Simple remark
dot tx.System.remark 0xdeadbeef --from alice --chain polkadot

# Transfer (amount in plancks)
dot tx.Balances.transferKeepAlive 5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty 1000000000000 --from alice --chain polkadot

# Estimate fees without submitting
dot tx.Balances.transferKeepAlive 5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty 1000000000000 --from alice --chain polkadot --dry-run

# Submit a raw SCALE-encoded call (e.g. from a multisig proposal or another tool)
dot tx 0x0503008eaf04151687736326c9fea17e25fc5287613693c912909cb226aa4794f26a48 --from alice --chain polkadot

# Batch multiple transfers with Utility.batchAll (comma-separated encoded calls)
A=$(dot tx.Balances.transfer_keep_alive 5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty 1000000000000 --encode --chain polkadot)
B=$(dot tx.Balances.transfer_keep_alive 5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y 2000000000000 --encode --chain polkadot)
dot tx.Utility.batchAll $A,$B --from alice --chain polkadot
```

The dot-prefix form works for `tx` too — these are equivalent:

```bash
dot tx.System.remark 0xdeadbeef --from alice --chain polkadot
dot polkadot.tx.System.remark 0xdeadbeef --from alice
```

#### Enum shorthand

Enum arguments accept a concise `Variant(value)` syntax instead of verbose JSON:

```bash
# Instead of: '{"type":"system","value":{"type":"Authorized"}}'
dot tx.Utility.dispatch_as 'system(Authorized)' $(dot tx.System.remark 0xcafe --encode --chain polkadot) --from alice --chain polkadot

# Nested enums work too
dot tx.Utility.dispatch_as 'system(Signed(5FHneW46...))' <call> --from alice --chain polkadot

# Void variants — empty parens or just the name
dot tx.Pallet.call 'Root()' ... --from alice --chain polkadot
dot tx.Pallet.call 'Root' ... --from alice --chain polkadot

# JSON inside parens for struct values
dot tx.Pallet.call 'AccountId32({"id":"0xd435..."})' ... --from alice --chain polkadot
```

Variant matching is case-insensitive (`system` resolves to `system`, `authorized` to `Authorized`). All existing formats (JSON objects, hex, SS58 addresses) continue to work unchanged.

#### Encode call data

Encode a call to hex without signing or submitting. Useful for preparing calls to pass to `Sudo.sudo`, multisig proposals, or governance. Works offline from cached metadata and does not require `--from`.

```bash
# Encode a remark call
dot tx.System.remark 0xdeadbeef --encode --chain polkadot

# Encode a transfer (use the hex output in a batch or sudo call)
dot tx.Balances.transfer_keep_alive 5FHneW46... 1000000000000 --encode --chain polkadot

# Use encoded output with Sudo.sudo
dot tx.Sudo.sudo $(dot tx.System.remark 0xcafe --encode --chain polkadot) --from alice --chain polkadot
```

#### Decode call data to YAML / JSON

Decode a hex-encoded call into a YAML or JSON file that is compatible with [file-based commands](#file-based-commands). This is useful for inspecting opaque call data, sharing human-readable transaction definitions, or editing parameters before re-submitting. Works offline from cached metadata and does not require `--from`.

```bash
# Decode a raw hex call to YAML
dot tx.0x0001076465616462656566 --to-yaml --chain polkadot

# Decode a raw hex call to JSON
dot tx.0x0001076465616462656566 --to-json --chain polkadot

# Encode a named call and output as YAML
dot tx.System.remark 0xdeadbeef --to-yaml --chain polkadot

# Round-trip: encode to hex, decode to YAML, re-encode from file
dot tx.System.remark 0xdeadbeef --encode --chain polkadot   # 0x0001076465616462656566
dot tx.0x0001076465616462656566 --to-yaml --chain polkadot > remark.yaml
dot ./remark.yaml --encode                                  # chain comes from the file
```

`--to-yaml` / `--to-json` are mutually exclusive with each other and with `--encode` and `--dry-run`.

Both dry-run and submission display the encoded call hex and a decoded human-readable form:

```
  Call:   0x0001076465616462656566
  Decode: System.remark(remark: 0xdeadbeef)
  Tx:     0xabc123...
  Status: ok
```

Complex calls (e.g. XCM teleports) that the primary decoder cannot handle are automatically decoded via a fallback path:

```
  Decode: PolkadotXcm.limited_teleport_assets { dest: V3 { parents: 1, interior: X1(Parachain(5140)) }, beneficiary: V3 { ... }, assets: V3 [...], fee_asset_item: 0, weight_limit: Unlimited }
```

#### Exit codes

The CLI exits with code **1** when a finalized transaction has a dispatch error (e.g. insufficient balance, bad origin). The full transaction output (events, explorer links) is still printed before the error so you can debug the failure. Module errors are formatted as `PalletName.ErrorVariant` (e.g. `Balances.InsufficientBalance`).

```bash
dot tx.Balances.transferKeepAlive 5FHneW46... 999999999999999999 --from alice --chain polkadot
# ... events and explorer links ...
# Error: Transaction dispatch error: Balances.InsufficientBalance
echo $?  # 1
```

#### Argument parsing errors

When a call argument is invalid, the CLI shows a contextual error message with the argument name, the expected type, and a hint:

```bash
dot tx.Balances.transferKeepAlive 5GrwvaEF... abc --encode --chain polkadot
# Error: Invalid value for argument 'value' (expected Compact<u128>): "abc"
#   Hint: Compact<u128>
```

For struct-based calls, the error identifies the specific field that failed. For tuple-based calls, it shows the argument index. The original parse error is preserved as the `cause` for programmatic access.

#### Wait level

By default, `dot tx` waits for finalization (~30s on Polkadot). Use `--wait` / `-w` to return earlier:

```bash
# Return as soon as the tx is broadcast (fastest)
dot tx.System.remark 0xdead --from alice --chain polkadot --wait broadcast

# Return when included in a best block
dot tx.System.remark 0xdead --from alice --chain polkadot -w best-block
dot tx.System.remark 0xdead --from alice --chain polkadot -w best    # alias

# Wait for finalization (default, unchanged)
dot tx.System.remark 0xdead --from alice --chain polkadot --wait finalized
dot tx.System.remark 0xdead --from alice --chain polkadot            # same
```

| Level | Resolves when | Events shown | Explorer links |
|-------|---------------|:---:|:---:|
| `broadcast` | Tx is broadcast to the network | — | — |
| `best-block` / `best` | Tx is included in a best block | yes | yes |
| `finalized` (default) | Tx is finalized | yes | yes |

The `--wait` flag is silently ignored when combined with `--dry-run` or `--encode` (both return before submission).

#### Custom signed extensions

Chains with non-standard signed extensions are auto-handled:

- `void` → empty bytes
- `Option<T>` → `None`
- enum with `Disabled` variant → `Disabled`

For manual override, use `--ext` with a JSON object:

```bash
dot tx.System.remark 0xdeadbeef --from alice --chain polkadot --ext '{"MyExtension":{"value":"..."}}'
```

Not sure which extensions a chain exposes? Run `dot <chain>.extensions` (see [Transaction extensions](#transaction-extensions)) to list them all with value types and a `[builtin]` / `[custom]` marker.

#### Transaction options

Override low-level transaction parameters. Useful for rapid-fire submission (custom nonce), priority fees (tip), or controlling transaction lifetime (mortality).

| Flag | Value | Description |
|------|-------|-------------|
| `--nonce <n>` | non-negative integer | Override the auto-detected nonce |
| `--tip <amount>` | non-negative integer (planck) | Priority tip for the transaction pool |
| `--mortality <spec>` | `immortal` or period (min 4) | Transaction mortality window |
| `--at <block>` | 0x-prefixed block hash | Block hash to validate against (defaults to finalized) |

```bash
# Fire-and-forget: submit two txs in rapid succession with manual nonces
dot tx.System.remark 0xdead --from alice --chain polkadot --nonce 0 --wait broadcast
dot tx.System.remark 0xbeef --from alice --chain polkadot --nonce 1 --wait broadcast

# Add a priority tip (in planck)
dot tx.Balances.transferKeepAlive 5FHneW46... 1000000000000 --from alice --chain polkadot --tip 1000000

# Submit an immortal transaction (no expiry)
dot tx.System.remark 0xdead --from alice --chain polkadot --mortality immortal

# Set a custom mortality period (rounds up to nearest power of two)
dot tx.System.remark 0xdead --from alice --chain polkadot --mortality 128

# Validate against a specific block hash
dot tx.System.remark 0xdead --from alice --chain polkadot --at 0x1234...abcd

# Combine: rapid-fire with tip and broadcast-only
dot tx.System.remark 0xdead --from alice --chain polkadot --nonce 5 --tip 500000 --wait broadcast
```

When set, nonce / tip / mortality / at are shown in both `--dry-run` and submission output. These flags are silently ignored with `--encode`, `--to-yaml`, and `--to-json` (which return before signing).

#### Pay fees in an alternative asset

On asset-hub-style chains (Polkadot Asset Hub, Paseo Asset Hub, etc.) the `ChargeAssetTxPayment` signed extension lets a transaction pay its fees in a non-native asset. Use `--asset <json>` to select the asset — the value is an XCM location (JSON) identifying the asset, which the runtime's asset-conversion pool swaps for native tokens at dispatch time.

```bash
# Pay fees in USDT (asset id 1337, PalletInstance 50) on Polkadot Asset Hub
dot tx.Balances.transfer_keep_alive 5FHneW46... 1000000000000 \
  --from alice --chain polkadot-asset-hub \
  --asset '{"parents":0,"interior":{"type":"X2","value":[{"type":"PalletInstance","value":50},{"type":"GeneralIndex","value":"1337"}]}}'

# Dry-run to see the native-denominated fee estimate
dot tx.Balances.transfer_keep_alive 5FHneW46... 1000000000000 \
  --from alice --chain polkadot-asset-hub --dry-run \
  --asset '{"parents":0,"interior":{"type":"X2","value":[{"type":"PalletInstance","value":50},{"type":"GeneralIndex","value":"1337"}]}}'
```

The `--asset` echo is included in dry-run and submission output (and `--json`). A few things to know:

- The target chain must expose `ChargeAssetTxPayment` in its signed extensions — asset-hub-style chains do; plain relay chains don't, and `--asset` is silently ignored on those.
- The estimated fee shown is **native-denominated**. The on-chain asset-conversion pool determines the actual asset amount charged at execution time.
- `--asset` is unnecessary (and not compatible) with `--unsigned`: unsigned transactions default `ChargeAssetTxPayment` to zero tip / no asset.
- Combine freely with `--tip`, `--nonce`, `--mortality`, and `--at`. `--tip` is encoded inside the asset-payment extension alongside the asset id.

Under the hood, the CLI routes the asset through its custom signed-extension pipeline rather than polkadot-api's native `asset` option — this works around a papi compatibility check that rejects XCM Location JSON on the unsafe API path.

#### Unsigned/authorized transactions

Submit transactions without a signer using `--unsigned`. This is for calls authorized by on-chain mechanisms (e.g. the `AuthorizeCall` extension) rather than cryptographic signatures — typically governance-authorized calls on chains like the People chain.

```bash
# Submit an authorized call on the People chain
dot tx.People.create_people_collection --unsigned --chain polkadot-people

# Dry-run to inspect before submitting
dot tx.People.create_people_collection --unsigned --chain polkadot-people --dry-run

# Encode the full general transaction bytes
dot tx.People.create_people_collection --unsigned --chain polkadot-people --encode

# With raw hex call data
dot tx 0x3306 --unsigned --chain polkadot-people

# JSON output for scripting
dot tx.People.create_people_collection --unsigned --chain polkadot-people --json
```

The CLI constructs a v5 general transaction with all extension values auto-defaulted (`VerifySignature::Disabled`, `Era::Immortal`, nonce `0`, tip `0`, etc.). Override individual extensions with `--ext` if needed.

`--unsigned` is mutually exclusive with `--from`, `--nonce`, `--tip`, and `--mortality`. File-based input supports `unsigned: true`:

```yaml
chain: polkadot-people
unsigned: true
tx:
  People:
    create_people_collection: null
```

### File-based commands

Run any `dot` command from a YAML or JSON file. Especially useful for complex calls like XCM messages that are hard to construct inline.

**Teleport DOT** from Asset Hub to the relay chain:

```yaml
# teleport-dot.xcm.yaml
chain: polkadot-asset-hub
tx:
  PolkadotXcm:
    limited_teleport_assets:
      dest:
        type: V4
        value:
          parents: 1
          interior:
            type: Here
      beneficiary:
        type: V4
        value:
          parents: 0
          interior:
            type: X1
            value:
              - type: AccountId32
                value:
                  network: null
                  id: "0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d"
      assets:
        type: V4
        value:
          - id:
              parents: 1
              interior:
                type: Here
            fun:
              type: Fungible
              value: 10000000000
      fee_asset_item: 0
      weight_limit:
        type: Unlimited
```

**Reserve transfer USDC** (asset 1337, 6 decimals) from Asset Hub to Hydration:

```yaml
# reserve-transfer-usdc.xcm.yaml
chain: polkadot-asset-hub
tx:
  PolkadotXcm:
    limited_reserve_transfer_assets:
      dest:
        type: V4
        value:
          parents: 1
          interior:
            type: X1
            value:
              - type: Parachain
                value: 2034
      beneficiary:
        type: V4
        value:
          parents: 0
          interior:
            type: X1
            value:
              - type: AccountId32
                value:
                  network: null
                  id: "0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d"
      assets:
        type: V4
        value:
          - id:
              parents: 0
              interior:
                type: X2
                value:
                  - type: PalletInstance
                    value: 50
                  - type: GeneralIndex
                    value: 1337
            fun:
              type: Fungible
              value: 10000000
      fee_asset_item: 0
      weight_limit:
        type: Unlimited
```

The same teleport in JSON:

```json
{
  "chain": "polkadot-asset-hub",
  "tx": {
    "PolkadotXcm": {
      "limited_teleport_assets": {
        "dest": { "type": "V4", "value": { "parents": 1, "interior": { "type": "Here" } } },
        "beneficiary": {
          "type": "V4",
          "value": {
            "parents": 0,
            "interior": {
              "type": "X1",
              "value": [{ "type": "AccountId32", "value": { "network": null, "id": "0xd435...a27d" } }]
            }
          }
        },
        "assets": {
          "type": "V4",
          "value": [{
            "id": { "parents": 1, "interior": { "type": "Here" } },
            "fun": { "type": "Fungible", "value": 10000000000 }
          }]
        },
        "fee_asset_item": 0,
        "weight_limit": { "type": "Unlimited" }
      }
    }
  }
}
```

```bash
# Run from file
dot ./teleport-dot.xcm.yaml --from alice --dry-run

# Encode only
dot ./reserve-transfer-usdc.xcm.yaml --encode

# Override variables
dot ./transfer.xcm.yaml --var AMOUNT=2000000000000 --from alice
```

The file format uses a required category wrapper (`tx`, `query`, `const`, or `apis`) with the structure `category > Pallet > Item > args`:

```yaml
# Simple transaction
tx:
  System:
    remark:
      - "0xdeadbeef"
```

```yaml
# Storage query
chain: polkadot
query:
  System:
    Account:
      - "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
```

```yaml
# Constant lookup
chain: polkadot
const:
  Balances:
    ExistentialDeposit:
```

**Variable substitution** uses shell-style `${VAR}` with optional defaults `${VAR:-default}`. Variables are resolved in order: `--var` flags > environment variables > `vars:` section defaults.

```yaml
chain: ${CHAIN:-polkadot}
vars:
  AMOUNT: "1000000000000"
tx:
  Balances:
    transfer_keep_alive:
      dest: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
      value: ${AMOUNT}
```

Hex values passed via `--var` are preserved as-is, including leading zeros. This is important for encoded call data in XCM `Transact` instructions or similar byte-array fields:

```bash
# Encode a remark, then embed it in an XCM Transact via --var
CALL=$(dot tx.System.remark 0xdead --encode --chain polkadot)
dot ./xcm-transact.yaml --var CALL=$CALL --encode
```

All existing flags work with file input — `--chain` overrides the file's `chain:` field, `--from`, `--dry-run`, `--encode`, `--to-yaml`, `--to-json`, `--json`, `--output`, etc. behave identically to inline commands.

### Compute hashes

Compute cryptographic hashes commonly used in Substrate. Supports BLAKE2b-256, BLAKE2b-128, Keccak-256, and SHA-256.

```bash
# Hash hex-encoded data
dot hash blake2b256 0xdeadbeef

# Hash plain text (UTF-8 encoded)
dot hash sha256 hello

# Hash file contents
dot hash keccak256 --file ./data.bin

# Read from stdin
echo -n "hello" | dot hash sha256 --stdin

# JSON output
dot hash blake2b256 0xdeadbeef --json
```

Run `dot hash` with no arguments to see all available algorithms.

### Sign messages

Sign arbitrary messages with an account keypair. Output is a `Sr25519(0x...)` value directly usable as a `MultiSignature` enum argument in transaction calls.

```bash
# Sign a text message
dot sign "hello world" --from alice

# Sign hex-encoded bytes
dot sign 0xdeadbeef --from alice

# Sign file contents
dot sign --file ./payload.bin --from alice

# Read from stdin
echo -n "hello" | dot sign --stdin --from alice

# JSON output (for scripting)
dot sign "hello" --from alice --json
```

Output shows the crypto type, message bytes in hex, raw signature, and an `Enum` value directly pasteable into tx arguments (e.g. `Sr25519(0x...)`).

Use `--type` to select the signature algorithm (default: `sr25519`). Run `dot sign` with no arguments to see usage and examples.

### Parachain sovereign accounts

Derive the sovereign account addresses for a parachain. These are deterministic accounts derived from a parachain ID — no chain connection required.

- **Child** accounts represent a parachain on the relay chain (prefix `"para"`)
- **Sibling** accounts represent a parachain on another parachain (prefix `"sibl"`)

```bash
# Show both child and sibling accounts
dot parachain 1000

# Show only the child (relay chain) account
dot parachain 2004 --type child

# Show only the sibling (parachain-to-parachain) account
dot parachain 2004 --type sibling

# Use Polkadot SS58 prefix (default: 42)
dot parachain 1000 --prefix 0

# JSON output
dot parachain 1000 --json
```

Run `dot parachain` with no arguments to see usage and examples.

### Bandersnatch member keys

Derive Bandersnatch member keys from account mnemonics for on-chain member set registration (personhood proofs, Ring VRF). Uses the [`verifiablejs`](https://github.com/paritytech/verifiablejs) WASM library.

```bash
# Derive unkeyed member key (lite person)
dot verifiable alice

# Derive keyed member key (full person — "candidate" context)
dot verifiable alice --context candidate

# Arbitrary context string
dot verifiable alice --context pps

# JSON output (for scripting)
dot verifiable alice --context candidate --json
```

The derivation flow:

```
Mnemonic → mnemonicToEntropy() → blake2b256(entropy, context?) → member_from_entropy() → 32-byte member key
```

- **Unkeyed** (no `--context`): `blake2b256(entropy)` — used for lite person registration
- **With context** (e.g. `--context candidate`): `blake2b256(entropy, key="candidate")` — used for full person registration. The `--context` value is passed as the raw UTF-8 bytes of the blake2b key parameter.
- Both 12-word and 24-word mnemonics are supported

Derived keys are saved to the account store. For stored accounts, saved keys appear in `dot account inspect` output. When creating a new account with `dot account create`, both unkeyed and `candidate` keys are automatically derived and saved.

Run `dot verifiable` with no arguments to see usage and the full derivation diagram.

### Getting help

Every command supports `--help` to show its detailed usage, available actions, and examples:

```bash
dot --help              # global help with all commands
dot account --help      # same as `dot account` — shows account actions
dot chain --help        # same as `dot chain` — shows chain actions
dot hash --help         # same as `dot hash` — shows algorithms and examples
```

#### Item-level help

Use `--help` on any fully-qualified dot-path to see metadata detail and category-specific usage hints. The chain is required (so the CLI knows which metadata to load), but the call itself runs offline from the cache:

```bash
dot tx.System.remark --help --chain polkadot                    # call args, docs, and tx options
dot query.System.Account --help --chain polkadot                # storage type, key/value info, and query options
dot const.Balances.ExistentialDeposit --help --chain polkadot   # constant type and docs
dot events.Balances.Transfer --help --chain polkadot            # event fields and docs
dot errors.Balances.InsufficientBalance --help --chain polkadot # error docs
dot apis.Core.version --help --chain polkadot                   # runtime API method signature and docs

# A chain prefix is equivalent
dot polkadot.tx.System.remark --help
```

For `tx` commands, omitting both `--from` and `--encode` shows this same help output instead of an error:

```bash
dot tx.System.remark 0xdead --chain polkadot   # shows call help (no error)
```

### Global options

| Flag | Description |
|------|-------------|
| `--help` | Show help (global or command-specific) |
| `--chain <name>` | Target chain (required unless a dotpath chain prefix is used) |
| `--rpc <url>` | Override RPC endpoint(s) for this call (repeat for fallback). Always fetches fresh metadata, bypassing the cache |

| `--json` | Structured JSON output (shorthand for `--output json`) |
| `--output json` | Structured JSON output |
| `--dump` | Dump all entries of a storage map (required for keyless map queries) |
| `-w, --wait <level>` | Tx wait level: `broadcast`, `best-block` / `best`, `finalized` (default) |

### Structured JSON output

Every command supports `--json` for machine-readable output. This works on data queries, metadata inspection, account management, chain configuration, and transaction submission:

```bash
dot inspect --json --chain polkadot                   # All pallets as JSON
dot inspect Balances --json --chain polkadot          # Pallet detail with storage, constants, calls, events, errors
dot chain list --json                                 # Configured chains
dot account list --json                               # Dev and stored accounts
dot account create my-key --json                      # New account details (mnemonic warning on stderr)
dot polkadot.tx.System.remark 0xdead --encode --json  # Encoded call hex wrapped in JSON
dot polkadot.events.Balances --json                   # Event listing with field signatures
dot polkadot.const.System --json                      # Constant listing with types
```

For transaction submission, `--json` emits NDJSON (one JSON object per lifecycle event):

```bash
dot tx.System.remark 0xdead --from alice --chain polkadot --json
# {"event":"signed","txHash":"0x..."}
# {"event":"broadcasted","txHash":"0x..."}
# {"event":"finalized","blockNumber":123,"blockHash":"0x...","ok":true,"events":[...]}
```

### Pipe-safe output

All commands follow Unix conventions: **data goes to stdout, progress goes to stderr**. This means you can safely pipe `--json` into `jq` or other tools without progress messages ("Fetching metadata...", spinner output, "Connecting...") corrupting the data stream:

```bash
dot polkadot.const.System.SS58Prefix --json | jq '.+1'
dot polkadot.query.System.Number --json | jq
dot chain list --json | jq '.chains[].name'
dot account list --json | jq '.stored[].address'
dot inspect --json --chain polkadot | jq '.pallets[] | select(.events > 10) | .name'
```

In an interactive terminal, both streams render together so you see progress and results normally.

### Shell completions

Generate shell completion scripts for tab-completing subcommands, chain names, pallet names, and item names. Completions use cached metadata — no network calls are made.

```bash
# zsh — add to ~/.zshrc
eval "$(dot completions zsh)"

# bash — add to ~/.bashrc
eval "$(dot completions bash)"

# fish — save to completions directory
dot completions fish > ~/.config/fish/completions/dot.fish
```

Once installed, press Tab to complete:

```bash
dot qu<Tab>              # → query
dot query.<Tab>          # → query.System, query.Balances, ...
dot query.System.<Tab>   # → query.System.Account, query.System.Number, ...
dot apis.<Tab>           # → apis.Core, apis.Metadata, ...
dot apis.Core.<Tab>      # → apis.Core.version, ...
dot polkadot.<Tab>       # → polkadot.query, polkadot.tx, ..., polkadot.apis
dot --chain <Tab>        # → polkadot, paseo, ...
dot --from <Tab>         # → alice, bob, ..., stored account names
dot chain <Tab>          # → add, remove, update, list
```

Completions are context-aware: `query.` shows pallets with storage items, `tx.` shows pallets with calls, `events.` and `errors.` filter accordingly, `apis.` shows runtime API names. Chain prefix paths like `polkadot.query.System.` work at any depth.

## How it compares

| | polkadot-cli | @polkadot/api-cli | subxt-cli | Pop CLI |
|---|---|---|---|---|
| **Query storage** | SS58 keys, map iteration | yes (full `--ws` URL required) | yes (keys as SCALE tuples, no SS58) | — |
| **Read constants** | yes | yes | yes | — |
| **Submit extrinsics** | yes, with dry-run | yes (via `--seed`) | — | ink! contract calls only |
| **Inspect metadata** | yes | — | yes (excellent browser) | — |
| **Chain presets** | built-in aliases (`--chain polkadot`) | — (manual `--ws` every call) | — | parachain templates |
| **Tx tracking + explorer links** | spinner progress, block + explorer link | basic events | — | — |

polkadot-cli aims to be the single tool for day-to-day chain interaction: storage reads, constant lookups, transaction submission, and metadata browsing with a polished terminal UX. @polkadot/api-cli covers similar ground but is in maintenance mode and requires verbose flags. subxt-cli has an excellent metadata explorer but cannot sign or submit transactions. Pop CLI targets a different workflow — scaffolding parachains and deploying ink! contracts rather than end-user chain queries.

Outside Polkadot, the closest comparable in terms of interactive UX is [near-cli-rs](https://github.com/near/near-cli-rs) (NEAR).

## Update notifications

After each command, the CLI checks whether a newer version is available on npm and displays a notification:

```
╭───────────────────────────────────────────────╮
│                                               │
│   Update available! 0.6.2 → 0.7.0            │
│   Run npm i -g polkadot-cli to update         │
│                                               │
╰───────────────────────────────────────────────╯
```

The version check runs in the background on startup and caches the result for 24 hours in `~/.polkadot/update-check.json`. Before exiting, the CLI waits up to 500ms for the check to finish so the cache file is written — even for fast commands like `--help` and `--version`. Long-running commands (queries, transactions) are unaffected since the check completes well before they finish.

If the network is unreachable, the failed check is cached for 1 hour so subsequent runs don't incur the 500ms wait repeatedly.

The notification is automatically suppressed when:

- `DOT_NO_UPDATE_CHECK=1` is set
- `CI` environment variable is set (any value)
- stderr is not a TTY (e.g. piped output)

## Configuration

Config and metadata caches live in `~/.polkadot/`:

```
~/.polkadot/
├── config.json          # configured chains
├── accounts.json        # stored accounts (⚠️ secrets are NOT encrypted — see below)
├── update-check.json    # cached update check result
└── chains/
    └── polkadot/
        └── metadata.bin # cached SCALE-encoded metadata
```

> **Warning:** `accounts.json` stores secrets (mnemonics and seeds) in **plain text**. Encrypted-at-rest storage is planned but not yet implemented. Keep appropriate file permissions (`chmod 600 ~/.polkadot/accounts.json`) and do not use this for high-value mainnet accounts.

## Environment compatibility

The CLI works in Node.js (v22+), Bun, and sandboxed runtimes (e.g. LLM tool-use / MCP environments). WebSocket connections use the native `WebSocket` implementation provided by the runtime — no external WebSocket package is required.

## Development

Requires [Bun](https://bun.sh).

```bash
bun install
bun run dev -- polkadot.query.System.Number
bun run build
bun test
```

## License

MIT
