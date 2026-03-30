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
- ✅ Support for custom signed extensions
- ✅ Built with agent use in mind — pipe-safe JSON output (`--output json`)
- ✅ Fuzzy matching with typo suggestions
- ✅ Account management — BIP39 mnemonics, derivation paths, env-backed secrets, watch-only, dev accounts
- ✅ Named address resolution across all commands
- ✅ Runtime API calls — `dot apis.Core.version`
- ✅ Batteries included — all system parachains and testnets already setup to be used
- ✅ File-based commands — run any command from a YAML/JSON file with variable substitution
- ✅ Parachain sovereign accounts — derive child and sibling addresses from a parachain ID

### Preconfigured chains

| Network | Chain | Light client |
|---------|-------|:---:|
| Polkadot | `polkadot` (relay, default) | yes |
| | `polkadot-asset-hub` | yes |
| | `polkadot-bridge-hub` | yes |
| | `polkadot-collectives` | yes |
| | `polkadot-coretime` | yes |
| | `polkadot-people` | yes |
| Paseo (testnet) | `paseo` (relay) | yes |
| | `paseo-asset-hub` | yes |
| | `paseo-bridge-hub` | — |
| | `paseo-collectives` | — |
| | `paseo-coretime` | yes |
| | `paseo-people` | yes |

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

# Add a chain via light client
dot chain add westend --light-client

# List configured chains
dot chain list

# Re-fetch metadata after a runtime upgrade
dot chain update          # updates default chain
dot chain update kusama   # updates a specific chain
dot chain update --all    # updates all configured chains in parallel

# Set default chain
dot chain default kusama

# Remove a chain
dot chain remove westend
```

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
MY_SECRET="word1 word2 ..." dot tx System.remark 0xdead --from ci-signer

# Remove one or more accounts
dot account remove my-validator
dot account delete my-validator stale-key

# Inspect an account — show public key and SS58 address
dot account inspect alice
dot account alice                    # shorthand (same as inspect)
dot account inspect 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
dot account inspect 0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d
dot account inspect alice --prefix 0         # Polkadot mainnet prefix
dot account inspect alice --output json      # JSON output
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
dot tx Balances.transferKeepAlive treasury 1000000000000 --from alice

# Query by account name
dot query System.Account treasury

# Dev accounts also resolve
dot tx Balances.transferKeepAlive bob 1000000000000 --from alice
```

Resolution order: dev account name > stored account name > SS58 address > hex public key. If the input doesn't match any, the CLI shows an error listing available account names.

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
dot account inspect alice --output json
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

### Chain prefix

Instead of the `--chain` flag, you can prefix any target with the chain name using dot notation:

```bash
dot query kusama.System.Account 5GrwvaEF...
dot const kusama.Balances.ExistentialDeposit
dot tx kusama.Balances.transferKeepAlive 5FHneW46... 1000000000000 --from alice
dot inspect kusama.System
dot inspect kusama.System.Account
```

Chain names are case-insensitive — `Polkadot.System.Account`, `POLKADOT.System.Account`, and `polkadot.System.Account` all resolve the same way. The same applies to `--chain Polkadot` and `dot chain default Polkadot`.

The `--chain` flag and default chain still work as before. If both a chain prefix and `--chain` flag are provided, the CLI errors.

### Space-separated syntax

Pallet and item segments can also be provided as separate arguments instead of dot notation. These forms are equivalent:

```bash
# Dot notation vs space-separated — these are identical:
dot query.System                          # dot notation
dot query System                          # space-separated

dot events.Balances.Transfer              # dot notation
dot events Balances Transfer              # space-separated

dot apis.Core                             # dot notation
dot apis Core                             # space-separated

# Especially useful with --chain flag:
dot --chain kusama query System
dot --chain kusama events Balances Transfer
dot --chain kusama apis Core
```

This works for all categories (`query`, `tx`, `const`, `events`, `errors`, `apis`). Remaining arguments after the pallet and item are passed as method parameters as usual.

### Query storage

```bash
# Plain storage value
dot query System.Number

# Map entry by key
dot query System.Account 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY

# Map without key — shows help/usage (use --dump to fetch all entries)
dot query System.Account

# Dump all map entries (requires --dump, default limit: 100)
dot query System.Account --dump --limit 10

# Enum variant as map key (case-insensitive)
dot query people-preview.ChunksManager.Chunks R2e9 1

# Pipe-safe — stdout is clean data, progress messages go to stderr
dot query System.Account --dump --limit 5 | jq '.[0].value.data.free'
dot query System.Number --output json | jq '.+1'

# Query a specific chain using chain prefix
dot query kusama.System.Account 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
```

#### Partial key queries

For storage maps with multiple keys (NMaps), you can provide fewer keys than
expected to retrieve all entries matching that prefix. This uses the chain's
prefix-based iteration and does not require `--dump`.

```bash
# Full key — returns a single value
dot query Staking.ErasStakers 100 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY

# Partial key — returns all entries matching the first key
dot query Staking.ErasStakers 100

# No keys — requires --dump (safety net for large maps)
dot query Staking.ErasStakers --dump --limit 10
```

The `--limit` option applies to partial key results just like it does for
`--dump` (default: 100, use `--limit 0` for unlimited).

#### Output formatting

Query results automatically convert on-chain types for readability:

- **BigInt** values (e.g. balances) render as decimal strings
- **Binary** fields (e.g. token `name`, `symbol`) render as text when the value contains only printable characters, or as `0x`-prefixed hex otherwise (values containing control characters, Private Use Area code points, or invalid UTF-8 sequences always fall back to hex)
- **Uint8Array** values render as `0x`-prefixed hex

```bash
# Token metadata — symbol and name display as text, not {}
dot query assethub-paseo.Assets.Metadata 50000413
# { "deposit": "6693666000", "name": "Paseo Token", "symbol": "PAS", ... }
```

### Look up constants

```bash
dot const Balances.ExistentialDeposit
dot const System.SS58Prefix --chain kusama
dot const kusama.Balances.ExistentialDeposit

# Pipe-safe — stdout is clean JSON, progress messages go to stderr
dot const Balances.ExistentialDeposit --output json | jq
```

### Inspect metadata

Works offline from cached metadata after the first fetch.

```bash
# List all pallets (shows storage, constants, calls, events, and errors counts)
dot inspect

# List a pallet's storage items, constants, calls, events, and errors
dot inspect System

# Detailed type info for a specific storage item or constant
dot inspect System.Account

# Call detail — shows argument signature and docs
dot inspect Balances.transfer_allow_death

# Event detail — shows field signature and docs
dot inspect Balances.Transfer

# Error detail — shows docs
dot inspect Balances.InsufficientBalance

# Inspect a specific chain using chain prefix
dot inspect kusama.System
dot inspect kusama.System.Account
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

Browse and call Substrate runtime APIs. These are top-level APIs exposed by the runtime (e.g. `Core`, `AccountNonceApi`, `TransactionPaymentApi`), accessed as `dot apis.ApiName.method`.

```bash
# List all runtime APIs with method counts
dot apis

# List methods in a specific API (with signatures)
dot apis.Core

# Call a runtime API method
dot apis.Core.version

# With chain prefix
dot polkadot.apis.Core.version

# Show method signature and docs
dot apis.Core.version --help
```

`api` is an alias for `apis`.

Runtime API info requires v15 metadata. If `dot apis` shows 0 APIs, update the cached metadata:

```bash
dot chain update              # default chain
dot chain update people-paseo # specific chain
dot chain update --all        # all configured chains
```

### Focused commands

Browse specific metadata categories directly without using `dot inspect`:

```bash
# List all pallets
dot pallets

# List pallet calls with argument signatures
dot calls Balances
dot calls Balances.transfer_allow_death   # call detail

# List pallet events with field signatures
dot events Balances
dot events Balances.Transfer              # event detail

# List pallet errors
dot errors Balances
dot errors Balances.InsufficientBalance   # error detail

# List pallet storage items with types
dot storage System
dot storage System.Account               # storage detail

# List pallet constants (dual-purpose — also works as value lookup)
dot const Balances                        # list constants
dot const Balances.ExistentialDeposit     # look up value

# List runtime APIs
dot apis                                  # list all APIs
dot apis.Core                             # list methods in Core
```

Each command supports `--chain <name>`, `--rpc <url>`, and chain prefix syntax. Singular and plural forms are interchangeable (e.g. `dot call` = `dot calls`, `dot event` = `dot events`, `dot api` = `dot apis`).

### Submit extrinsics

Build, sign, and submit transactions. Pass a `Pallet.Call` with arguments, or a raw SCALE-encoded call hex (e.g. from a multisig proposal or governance). Both forms display a decoded human-readable representation of the call.

```bash
# Simple remark
dot tx System.remark 0xdeadbeef --from alice

# Transfer (amount in plancks)
dot tx Balances.transferKeepAlive 5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty 1000000000000 --from alice

# Estimate fees without submitting
dot tx Balances.transferKeepAlive 5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty 1000000000000 --from alice --dry-run

# Submit a raw SCALE-encoded call (e.g. from a multisig proposal or another tool)
dot tx 0x0503008eaf04151687736326c9fea17e25fc5287613693c912909cb226aa4794f26a48 --from alice

# Batch multiple transfers with Utility.batchAll (comma-separated encoded calls)
A=$(dot tx Balances.transfer_keep_alive 5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty 1000000000000 --encode)
B=$(dot tx Balances.transfer_keep_alive 5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y 2000000000000 --encode)
dot tx Utility.batchAll $A,$B --from alice
```

#### Enum shorthand

Enum arguments accept a concise `Variant(value)` syntax instead of verbose JSON:

```bash
# Instead of: '{"type":"system","value":{"type":"Authorized"}}'
dot tx Utility.dispatch_as 'system(Authorized)' $(dot tx System.remark 0xcafe --encode) --from alice

# Nested enums work too
dot tx Utility.dispatch_as 'system(Signed(5FHneW46...))' <call> --from alice

# Void variants — empty parens or just the name
dot tx ... 'Root()' ...
dot tx ... 'Root' ...

# JSON inside parens for struct values
dot tx ... 'AccountId32({"id":"0xd435..."})' ...
```

Variant matching is case-insensitive (`system` resolves to `system`, `authorized` to `Authorized`). All existing formats (JSON objects, hex, SS58 addresses) continue to work unchanged.

#### Encode call data

Encode a call to hex without signing or submitting. Useful for preparing calls to pass to `Sudo.sudo`, multisig proposals, or governance. Works offline from cached metadata and does not require `--from`.

```bash
# Encode a remark call
dot tx System.remark 0xdeadbeef --encode

# Encode a transfer (use the hex output in a batch or sudo call)
dot tx Balances.transfer_keep_alive 5FHneW46... 1000000000000 --encode

# Use encoded output with Sudo.sudo
dot tx Sudo.sudo $(dot tx System.remark 0xcafe --encode) --from alice
```

#### Decode call data to YAML / JSON

Decode a hex-encoded call into a YAML or JSON file that is compatible with [file-based commands](#file-based-commands). This is useful for inspecting opaque call data, sharing human-readable transaction definitions, or editing parameters before re-submitting. Works offline from cached metadata and does not require `--from`.

```bash
# Decode a raw hex call to YAML
dot tx.0x0001076465616462656566 --yaml

# Decode a raw hex call to JSON
dot tx.0x0001076465616462656566 --json

# Encode a named call and output as YAML
dot tx.System.remark 0xdeadbeef --yaml

# Round-trip: encode to hex, decode to YAML, re-encode from file
dot tx.System.remark 0xdeadbeef --encode           # 0x0001076465616462656566
dot tx.0x0001076465616462656566 --yaml > remark.yaml
dot ./remark.yaml --encode                          # same hex
```

`--yaml` / `--json` are mutually exclusive with each other and with `--encode` and `--dry-run`.

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
dot tx Balances.transferKeepAlive 5FHneW46... 999999999999999999 --from alice
# ... events and explorer links ...
# Error: Transaction dispatch error: Balances.InsufficientBalance
echo $?  # 1
```

#### Argument parsing errors

When a call argument is invalid, the CLI shows a contextual error message with the argument name, the expected type, and a hint:

```bash
dot tx Balances.transferKeepAlive 5GrwvaEF... abc --encode
# Error: Invalid value for argument 'value' (expected Compact<u128>): "abc"
#   Hint: Compact<u128>
```

For struct-based calls, the error identifies the specific field that failed. For tuple-based calls, it shows the argument index. The original parse error is preserved as the `cause` for programmatic access.

#### Wait level

By default, `dot tx` waits for finalization (~30s on Polkadot). Use `--wait` / `-w` to return earlier:

```bash
# Return as soon as the tx is broadcast (fastest)
dot tx System.remark 0xdead --from alice --wait broadcast

# Return when included in a best block
dot tx System.remark 0xdead --from alice -w best-block
dot tx System.remark 0xdead --from alice -w best    # alias

# Wait for finalization (default, unchanged)
dot tx System.remark 0xdead --from alice --wait finalized
dot tx System.remark 0xdead --from alice             # same
```

| Level | Resolves when | Events shown | Explorer links |
|-------|---------------|:---:|:---:|
| `broadcast` | Tx is broadcast to the network | — | — |
| `best-block` / `best` | Tx is included in a best block | yes | yes |
| `finalized` (default) | Tx is finalized | yes | yes |

The `--wait` flag is silently ignored when combined with `--dry-run` or `--encode` (both return before submission).

#### Custom signed extensions

Chains with non-standard signed extensions (e.g. `people-preview`) are auto-handled:

- `void` → empty bytes
- `Option<T>` → `None`
- enum with `Disabled` variant → `Disabled`

For manual override, use `--ext` with a JSON object:

```bash
dot tx System.remark 0xdeadbeef --from alice --ext '{"MyExtension":{"value":"..."}}'
```

#### Transaction options

Override low-level transaction parameters. Useful for rapid-fire submission (custom nonce), priority fees (tip), or controlling transaction lifetime (mortality).

| Flag | Value | Description |
|------|-------|-------------|
| `--nonce <n>` | non-negative integer | Override the auto-detected nonce |
| `--tip <amount>` | non-negative integer (planck) | Priority tip for the transaction pool |
| `--mortality <spec>` | `immortal` or period (min 4) | Transaction mortality window |
| `--at <block>` | `best`, `finalized`, or 0x-prefixed block hash | Block state to validate against |

```bash
# Fire-and-forget: submit two txs in rapid succession with manual nonces
dot tx System.remark 0xdead --from alice --nonce 0 --wait broadcast
dot tx System.remark 0xbeef --from alice --nonce 1 --wait broadcast

# Add a priority tip (in planck)
dot tx Balances.transferKeepAlive 5FHneW46... 1000000000000 --from alice --tip 1000000

# Submit an immortal transaction (no expiry)
dot tx System.remark 0xdead --from alice --mortality immortal

# Set a custom mortality period (rounds up to nearest power of two)
dot tx System.remark 0xdead --from alice --mortality 128

# Validate against the best (not finalized) block
dot tx System.remark 0xdead --from alice --at best

# Combine: rapid-fire with tip and broadcast-only
dot tx System.remark 0xdead --from alice --nonce 5 --tip 500000 --wait broadcast
```

When set, nonce / tip / mortality / at are shown in both `--dry-run` and submission output. These flags are silently ignored with `--encode`, `--yaml`, and `--json` (which return before signing).

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
CALL=$(dot tx.System.remark 0xdead --encode)
dot ./xcm-transact.yaml --var CALL=$CALL --encode
```

All existing flags work with file input — `--chain` overrides the file's `chain:` field, `--from`, `--dry-run`, `--encode`, `--yaml`, `--json`, `--output`, etc. behave identically to inline commands.

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
dot hash blake2b256 0xdeadbeef --output json
```

Run `dot hash` with no arguments to see all available algorithms.

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
dot parachain 1000 --output json
```

Run `dot parachain` with no arguments to see usage and examples.

### Getting help

Every command supports `--help` to show its detailed usage, available actions, and examples:

```bash
dot --help              # global help with all commands
dot account --help      # same as `dot account` — shows account actions
dot chain --help        # same as `dot chain` — shows chain actions
dot hash --help         # same as `dot hash` — shows algorithms and examples
```

#### Item-level help

Use `--help` on any fully-qualified dot-path to see metadata detail and category-specific usage hints — all offline, no chain connection required:

```bash
dot tx.System.remark --help               # call args, docs, and tx options
dot query.System.Account --help           # storage type, key/value info, and query options
dot const.Balances.ExistentialDeposit --help  # constant type and docs
dot events.Balances.Transfer --help       # event fields and docs
dot errors.Balances.InsufficientBalance --help  # error docs
dot apis.Core.version --help             # runtime API method signature and docs
```

For `tx` commands, omitting both `--from` and `--encode` shows this same help output instead of an error:

```bash
dot tx.System.remark 0xdead               # shows call help (no error)
```

### Global options

| Flag | Description |
|------|-------------|
| `--help` | Show help (global or command-specific) |
| `--chain <name>` | Target chain (default from config) |
| `--rpc <url>` | Override RPC endpoint(s) for this call (repeat for fallback) |
| `--light-client` | Use Smoldot light client |
| `--output json` | Raw JSON output (default: pretty) |
| `--dump` | Dump all entries of a storage map (required for keyless map queries) |
| `--limit <n>` | Max entries for map queries (0 = unlimited, default: 100) |
| `-w, --wait <level>` | Tx wait level: `broadcast`, `best-block` / `best`, `finalized` (default) |

### Pipe-safe output

All commands follow Unix conventions: **data goes to stdout, progress goes to stderr**. This means you can safely pipe `--output json` into `jq` or other tools without progress messages ("Fetching metadata...", spinner output, "Connecting...") corrupting the data stream:

```bash
dot const System.SS58Prefix --output json | jq '.+1'
dot query System.Number --output json | jq
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
dot chain <Tab>          # → add, remove, update, list, default
```

Completions are context-aware: `query.` shows pallets with storage items, `tx.` shows pallets with calls, `events.` and `errors.` filter accordingly, `apis.` shows runtime API names. Chain prefix paths like `polkadot.query.System.` work at any depth.

## How it compares

| | polkadot-cli | @polkadot/api-cli | subxt-cli | Pop CLI |
|---|---|---|---|---|
| **Query storage** | SS58 keys, map iteration | yes (full `--ws` URL required) | yes (keys as SCALE tuples, no SS58) | — |
| **Read constants** | yes | yes | yes | — |
| **Submit extrinsics** | yes, with dry-run | yes (via `--seed`) | — | ink! contract calls only |
| **Inspect metadata** | yes | — | yes (excellent browser) | — |
| **Chain presets** | built-in aliases (`--chain kusama`) | — (manual `--ws` every call) | — | parachain templates |
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
├── config.json          # chains and default chain
├── accounts.json        # stored accounts (⚠️ secrets are NOT encrypted — see below)
├── update-check.json    # cached update check result
└── chains/
    └── polkadot/
        └── metadata.bin # cached SCALE-encoded metadata
```

> **Warning:** `accounts.json` stores secrets (mnemonics and seeds) in **plain text**. Encrypted-at-rest storage is planned but not yet implemented. Keep appropriate file permissions (`chmod 600 ~/.polkadot/accounts.json`) and do not use this for high-value mainnet accounts.

## Environment compatibility

The CLI works in Node.js, Bun, and sandboxed runtimes (e.g. LLM tool-use / MCP environments) that lack a native `globalThis.WebSocket`. WebSocket connections use the [`ws`](https://github.com/websockets/ws) package explicitly, so no global polyfill is required.

## Development

Requires [Bun](https://bun.sh).

```bash
bun install
bun run dev -- query System.Number
bun run build
bun test
```

## License

MIT
