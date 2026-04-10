# polkadot-cli

A command-line tool for interacting with Polkadot-ecosystem chains. Manage chains and accounts, query storage, look up constants, inspect metadata, submit extrinsics, and compute hashes — all from your terminal. [View on GitHub](https://github.com/peetzweg/polkadot-cli).

## Features

- ✅ Same syntax as [polkadot-api](https://papi.how) (PAPI)
- ✅ Chain name prefix — `dot polkadot.query.System.Number`
- ✅ zsh, bash, and fish autocompletion
- ✅ Exposes all on-chain metadata documentation
- ✅ Encode, dry-run, and submit extrinsics
- ✅ Support for custom signed extensions
- ✅ Built with agent use in mind — structured JSON output on every command (`--json`)
- ✅ Fuzzy matching with typo suggestions
- ✅ Account management — BIP39 mnemonics, derivation paths, env-backed secrets, watch-only, dev accounts
- ✅ Named address resolution across all commands
- ✅ Runtime API calls — `dot apis.Core.version`
- ✅ Batteries included — all system parachains and testnets already setup to be used
- ✅ File-based commands — run any command from a YAML/JSON file with variable substitution
- ✅ Parachain sovereign accounts — derive child and sibling addresses from a parachain ID
- ✅ Message signing — sign arbitrary bytes with account keypairs for use as `MultiSignature` arguments
- ✅ Bandersnatch member keys — derive Ring VRF member keys from mnemonics for on-chain member sets

## Install

Install globally via npm:

```
npm install -g polkadot-cli@latest
```

This installs the `dot` command globally. Ships with Polkadot and all system parachains preconfigured with multiple fallback RPC endpoints. Add any Substrate-based chain by pointing to its RPC endpoint(s).

## Chains

Manage chain connections. Polkadot is configured by default along with all system parachains for both Polkadot and Paseo networks. Add any Substrate-based chain by pointing to its RPC endpoint(s).

### Preconfigured chains

The following chains are available out of the box — no `dot chain add` needed:

| Network | Chain |
|---------|-------|
| Polkadot | `polkadot` (relay, default) |
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

Each chain ships with multiple RPC endpoints from decentralized infrastructure providers (IBP, Dotters, Dwellir, and others). The CLI automatically falls back to the next endpoint if the primary is unreachable. Use `dot chain list` to see all endpoints for each chain.

### Add a chain

Connect to a chain via WebSocket RPC. Use repeated `--rpc` flags to configure multiple endpoints with automatic fallback — if the primary is unreachable, the CLI tries the next one:

```
# Single RPC
dot chain add kusama --rpc wss://kusama-rpc.polkadot.io

# Multiple RPCs with fallback
dot chain add kusama --rpc wss://kusama-rpc.polkadot.io --rpc wss://kusama-rpc.dwellir.com
```

### List chains

Show all configured chains and which one is the default:

```
dot chains
dot chain list
```

Both forms are equivalent. `dot chains` is a shorthand that skips the `list` subcommand. Running `dot chain` with no action shows help with all available actions.

### Update metadata

Re-fetch metadata after a runtime upgrade. Targets the default chain if no name is given:

```
dot chain update
dot chain update kusama
dot chain update --all
```

### Set default chain

Change which chain commands target by default:

```
dot chain default kusama
```

### Remove a chain

```
dot chain remove westend
```

## Accounts

Manage signing accounts. Dev accounts (Alice, Bob, Charlie, Dave, Eve, Ferdie) are always available on testnets — no import needed.

### List accounts

Show all accounts, both dev and stored:

```
dot accounts
dot account list
```

Both forms are equivalent. `dot accounts` is a shorthand that skips the `list` subcommand. Running `dot account` with no action shows help with all available actions.

### Create an account

Generate a new BIP39 mnemonic and store the account:

```
dot account create my-validator
dot account new my-validator
```

`new` is an alias for `create`. Use `--path` to derive from a non-root path:

```
dot account create my-staking --path //staking
```

### Add a watch-only address

Store a named address without a secret — useful for frequently-used recipients, multisig members, or query targets. Accepts SS58 addresses or hex public keys:

```
dot account add treasury 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
dot account add council 0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d
```

Watch-only accounts appear in `dot account list` with a `(watch-only)` badge. They can be inspected and removed like any other account but cannot be used with `--from` (signing) or as a source for `derive`.

The `add` subcommand is context-sensitive:
- `add <name> <address>` — creates a watch-only entry (no secret)
- `add <name> --secret "..."` — imports a keyed account (same as `import`)
- `add <name> --env VAR` — imports an env-backed account (same as `import`)

### Import an account

Import from a BIP39 mnemonic or raw hex seed:

```
dot account import treasury --secret "word1 word2 ... word12"
dot account import raw-key --secret 0xabcdef...
```

Use `--path` to import with a derivation path:

```
dot account import hot-wallet --secret "word1 word2 ... word12" --path //hot
```

### Import an env-var-backed account

Store a reference to an environment variable instead of the secret itself. The secret never touches disk — ideal for CI/CD pipelines and security-conscious workflows:

```
dot account import ci-signer --env MY_SECRET
```

`--secret` and `--env` are mutually exclusive. Both `--secret` and `--env` can be combined with `--path`:

```
dot account import ci-signer --env MY_SECRET --path //ci
```

At signing time, the CLI reads `$MY_SECRET` and derives the keypair. If the variable is not set, the CLI errors with a clear message.

`account list` shows an `(env: MY_SECRET)` badge and resolves the address live when the variable is available:

```
dot accounts
# ci-signer (env: MY_SECRET)  5EPCUjPx...
```

Use the account like any other:

```
MY_SECRET="word1 word2 ..." dot tx.System.remark 0xdead --from ci-signer
```

### Derive a child account

Create a new account from an existing one with a different derivation path. The derived account shares the same secret but produces a different keypair:

```
dot account derive treasury treasury-staking --path //staking
```

`derive` requires a source account name, a new account name, and `--path`. Works with env-backed accounts too — the derived account shares the same env var reference.

### Derivation paths

Use `--path` with `create`, `import`, or `derive` to derive child keys from the same secret. Different paths produce different keypairs, enabling key separation (e.g. staking vs. governance) without managing multiple mnemonics.

Derivation paths use the Substrate convention: `//hard` for hard derivation, `/soft` for soft derivation. Paths can have multiple segments:

```
dot account create validator --path //staking
dot account create multi --path //polkadot//0/wallet
dot account import treasury --secret "..." --path //hot
dot account derive treasury treasury-gov --path //governance
```

`account list` shows the derivation path, env badge, and watch-only badge next to the account name:

```
  treasury (watch-only)  5GrwvaEF...
  treasury-staking (//staking)  5FHneW46...
  ci-signer (//ci) (env: MY_SECRET)  5EPCUjPx...
```

### Named address resolution

Named accounts — both watch-only and keyed — resolve automatically everywhere an AccountId32 or MultiAddress is expected. This works in `dot tx` arguments and `dot query` keys:

```
# Use a named account as transfer recipient
dot tx.Balances.transferKeepAlive treasury 1000000000000 --from alice

# Query by account name
dot query.System.Account treasury

# Dev accounts also resolve
dot tx.Balances.transferKeepAlive bob 1000000000000 --from alice
```

Resolution order:

1. **Dev account name** (`alice`, `bob`, etc.) — resolves to the dev account's SS58 address
2. **Stored account name** — resolves to the account's SS58 address (works for both keyed and watch-only accounts)
3. **SS58 address** — passed through as-is
4. **Hex public key** (`0x` + 64 hex chars) — passed through as-is
5. **Error** — shows available account names

This means you can save commonly-used addresses once and reference them by name everywhere, avoiding copy-paste of long SS58 strings.

### Remove accounts

Remove one or more stored accounts in a single command. When multiple names are given, the command validates all of them before deleting any — if one name is invalid, nothing is removed.

```
dot account remove my-validator
dot account delete my-validator stale-key
```

`delete` is an alias for `remove`.

### Inspect accounts

Convert between SS58 addresses, hex public keys, and account names. Accepts any of:

- **Dev account name** (`alice`, `bob`, etc.) — resolves to public key and SS58
- **Stored account name** — looks up the public key from the accounts file
- **SS58 address** — decodes to the underlying public key
- **Hex public key** (`0x` + 64 hex chars) — encodes to SS58

```
dot account inspect alice
dot account alice                    # shorthand — unknown subcommands fall through to inspect

dot account inspect 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
dot account inspect 0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d
```

Use `--prefix` to encode the SS58 address with a specific network prefix (default: 42):

```
dot account inspect alice --prefix 0     # Polkadot mainnet (prefix 0, starts with '1')
dot account inspect alice --prefix 2     # Kusama (prefix 2)
```

Output:

```
  Account Info

  Name:        Alice
  Public Key:  0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d
  SS58:        5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
  Prefix:      42
```

JSON output:

```
dot account inspect alice --json
# {"publicKey":"0xd435...a27d","ss58":"5Grw...utQY","prefix":42,"name":"Alice"}
```

## Chain Prefix

Prefix any dot-path with a chain name to target a specific chain instead of using the `--chain` flag:

```
dot kusama.query.System.Account 5GrwvaEF...
dot kusama.const.Balances.ExistentialDeposit
dot kusama.tx.Balances.transferKeepAlive 5FHneW46... 1000000000000 --from alice
dot inspect kusama.System
dot inspect kusama.System.Account
```

Chain names are case-insensitive — `polkadot.query.System.Account`, `Polkadot.query.System.Account`, and `POLKADOT.query.System.Account` all resolve the same way. The same applies to `--chain Polkadot` and `dot chain default Polkadot`.

The `--chain` flag and default chain still work as before. Using a dot-path without a chain prefix continues to target the default chain. If both a chain prefix and `--chain` flag are provided, the CLI errors with a clear message.

For `inspect`, a two-segment input like `kusama.System` is disambiguated by checking configured chain names. Chain names (lowercase, e.g. `kusama`) and pallet names (PascalCase, e.g. `System`) don't collide in practice. If they did, the chain prefix takes priority and `--chain` serves as an escape hatch.

## Space-Separated Syntax

Pallet and item segments can also be provided as separate arguments instead of dot notation. These forms are equivalent:

```
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

## Query

Read on-chain storage using dot-path syntax: `dot query.Pallet.Item`. Fetch plain values, look up map entries by key, or enumerate all entries. Use `dot query` to list pallets with storage items, or `dot query.Pallet` to list a pallet's storage items.

```
# Plain storage value
dot query.System.Number

# Map entry by key
dot query.System.Account 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY

# Map without key — shows help/usage (use --dump to fetch all entries)
dot query.System.Account

# Dump all map entries (requires --dump)
dot query.System.Account --dump

# Pipe-safe — stdout is clean data, progress messages go to stderr
dot query.System.Account --dump | jq '.[0].value.data.free'
dot query.System.Number --json | jq '.+1'

# Enum variant as map key (case-insensitive)
dot people-preview.query.ChunksManager.Chunks R2e9 1

# Query a specific chain using chain prefix
dot kusama.query.System.Account 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY

# List pallets with storage items
dot query

# List storage items in a pallet
dot query.System
```

### Partial key queries

For storage maps with multiple keys (NMaps), you can provide fewer keys than expected to retrieve all entries matching that prefix. This uses the chain's prefix-based iteration and does not require `--dump`.

```
# Full key — returns a single value
dot query.Staking.ErasStakers 100 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY

# Partial key — returns all entries matching the first key
dot query.Staking.ErasStakers 100

# No keys — requires --dump (safety net for large maps)
dot query.Staking.ErasStakers --dump
```

### Output formatting

Query results automatically convert on-chain types for readability:

- **BigInt** values (e.g. balances) render as decimal strings
- **Binary** fields (e.g. token `name`, `symbol`) render as text when the value contains only printable characters, or as `0x`-prefixed hex otherwise (values containing control characters, Private Use Area code points, or invalid UTF-8 sequences always fall back to hex)
- **Uint8Array** values render as `0x`-prefixed hex

```
# Token metadata — symbol and name display as text, not {}
dot assethub-paseo.query.Assets.Metadata 50000413
# { "deposit": "6693666000", "name": "Paseo Token", "symbol": "PAS", ... }
```

## Constants

Look up runtime constants using dot-path syntax: `dot const.Pallet.Constant`. Use `dot const` to list pallets with constants, or `dot const.Pallet` to list a pallet's constants.

```
dot const.Balances.ExistentialDeposit
dot const.System.SS58Prefix --chain kusama
dot kusama.const.Balances.ExistentialDeposit

# List pallets with constants
dot const

# List constants in a pallet (offline)
dot const.Balances

# Pipe-safe — stdout is clean JSON, progress messages go to stderr
dot const.Balances.ExistentialDeposit --json | jq
```

`consts` and `constants` are aliases for `const`.

## Inspect

Browse chain metadata offline (uses the cached copy after the first fetch). Shows storage items, constants, calls, events, and errors for each pallet. `explore` is an alias for `inspect`.

```
# List all pallets (shows storage, constants, calls, events, and errors counts)
dot inspect
dot explore                    # alias

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

### Pallet listing

All listings — pallets, storage items, constants, calls, events, and errors — are sorted alphabetically, making it easy to scan for a specific item.

When inspecting a pallet (e.g. `dot inspect Balances`), each item shows type information inline so you can understand the shape without drilling into the detail view:

**Storage items** show key and value types. Map items include a `[map]` tag:

```
  Storage Items:
    Account: AccountId32 → { free: u128, reserved: u128, frozen: u128, flags: u128 }    [map]
        The Balances pallet example of storing the balance of an account.
    TotalIssuance: u128
        The total units issued in the system.
```

**Constants** show their type:

```
  Constants:
    ExistentialDeposit: u128
        The minimum amount required to keep an account open.
    MaxLocks: u32
        The maximum number of locks that should exist on an account.
```

**Calls** show their full argument signature:

```
  Calls:
    transfer_allow_death(dest: enum(5 variants), value: Compact<u128>)
        Transfer some liquid free balance to another account.
    force_transfer(source: enum(5 variants), dest: enum(5 variants), value: Compact<u128>)
```

**Events** show their field signature:

```
  Events:
    Transfer(from: AccountId32, to: AccountId32, amount: u128)
        Transfer succeeded.
    Deposit(who: AccountId32, amount: u128)
        Some amount was deposited (e.g. for transaction fees).
```

**Errors** show their name and documentation:

```
  Errors:
    InsufficientBalance
        Balance too low to send value.
    VestingBalance
        Vesting balance too high to send value.
```

The first sentence of the documentation is shown below each item. Abbreviations like `e.g.`, `i.e.`, and `etc.` are handled correctly and don't cause early truncation. Drill into any item for the full documentation.

### Item detail

Drill into any item for full details. For example, `dot inspect Balances.transfer_allow_death` shows the argument signature and full documentation from the runtime metadata:

```
  Balances.transfer_allow_death (Call)

  Args: (dest: AccountId32, value: Compact<u128>)

  Transfer some liquid free balance to another account.
  ...
```

Event and error detail views follow the same pattern:

```
  Balances.Transfer (Event)

  Fields: (from: AccountId32, to: AccountId32, amount: u128)

  Transfer succeeded.
```

```
  Balances.InsufficientBalance (Error)

  Balance too low to send value.
```

Use call inspection to discover argument names, types, and documentation before constructing `dot tx` commands.

## Focused Listing

Each category supports partial paths for browsing metadata. Category-only invocations list pallets (or APIs); pallet-level invocations list items; item-level invocations show detail. All support `--chain <name>`, `--rpc <url>`, and chain prefix syntax. Singular and plural aliases work: `event` = `events`, `error` = `errors`, `api` = `apis`.

### Calls (tx listing)

```
dot tx                                     # list pallets with calls
dot tx.Balances                            # list calls with arg signatures
dot tx.Balances.transfer_allow_death       # call detail
```

### Events

```
dot events                                 # list pallets with events
dot events.Balances                        # list events with field signatures
dot events.Balances.Transfer               # event detail
```

### Errors

```
dot errors                                 # list pallets with errors
dot errors.Balances                        # list errors with docs
dot errors.Balances.InsufficientBalance    # error detail
```

### Storage (query listing)

```
dot query                                  # list pallets with storage items
dot query.System                           # list storage items with types
dot query.System.Account                   # storage help (use --dump for all entries)
dot query.System.Account --dump            # fetch all map entries
```

### Constants (const listing)

```
dot const                                  # list pallets with constants
dot const.Balances                         # list constants (offline)
dot const.Balances.ExistentialDeposit      # look up value (connects to chain)
```

### Runtime APIs

Browse and call Substrate runtime APIs. Unlike pallets, runtime APIs are top-level named interfaces (e.g. `Core`, `AccountNonceApi`, `TransactionPaymentApi`) that expose methods callable via `dot apis.ApiName.method`.

```
dot apis                                   # list all runtime APIs with method counts
dot apis.Core                              # list methods in Core API with signatures
dot apis.Core.version                      # call the Core.version runtime API
dot apis.AccountNonceApi.account_nonce <addr>  # call with arguments
```

Chain prefix and `--help` work the same as other categories:

```
dot polkadot.apis.Core.version             # target a specific chain
dot apis.Core.version --help               # show method signature, return type, and docs
```

`api` is an alias for `apis`. Shell completions work at every level: `apis.<Tab>` shows API names, `apis.Core.<Tab>` shows method names.

Runtime API info requires v15 metadata. If `dot apis` shows 0 APIs, the CLI will suggest updating your cached metadata. Run `dot chain update` (or `dot chain update <chain>`, or `dot chain update --all` for all chains) to fetch the latest version.

## Transactions

Build, sign, and submit extrinsics using dot-path syntax: `dot tx.Pallet.Call`. Pass arguments after the dot-path, or submit a raw SCALE-encoded call hex. Both forms display a decoded human-readable representation of the call.

### Basic usage

```
# Simple remark
dot tx.System.remark 0xdeadbeef --from alice

# Transfer (amount in plancks)
dot tx.Balances.transferKeepAlive 5FHneW46... 1000000000000 --from alice
```

### Dry run

Estimate fees without submitting:

```
dot tx.Balances.transferKeepAlive 5FHneW46... 1000000000000 --from alice --dry-run
```

### Raw call data

Submit a raw SCALE-encoded call hex (e.g. from a multisig proposal or another tool):

```
dot tx 0x0503008eaf04151687736326c9fea17e25fc528761369... --from alice
```

### Batch calls

Use `Utility.batchAll` to combine multiple calls into one transaction. The easiest way is to encode individual calls first, then pass them comma-separated:

```
# Encode individual calls
A=$(dot tx Balances.transfer_keep_alive 5FHneW46... 1000000000000 --encode)
B=$(dot tx Balances.transfer_keep_alive 5FLSigC9... 2000000000000 --encode)

# Batch them (comma-separated encoded calls)
dot tx Utility.batchAll $A,$B --from alice
```

Any `Vec<T>` parameter accepts comma-separated elements as an alternative to JSON arrays. This works for all calls, not just batch.

You can also use a JSON array for complex call objects:

```
dot tx.Utility.batchAll '[
  {
    "type": "Balances",
    "value": {
      "type": "transfer_keep_alive",
      "value": {
        "dest": "5FHneW46...",
        "value": 1000000000000
      }
    }
  },
  {
    "type": "Balances",
    "value": {
      "type": "transfer_keep_alive",
      "value": {
        "dest": "5FLSigC9...",
        "value": 2000000000000
      }
    }
  }
]' --from alice
```

### Enum shorthand

Enum arguments accept a concise `Variant(value)` syntax instead of verbose JSON. This is especially useful for calls like `Utility.dispatch_as` where the origin is an enum:

```
# Before (verbose JSON)
dot tx.Utility.dispatch_as '{"type":"system","value":{"type":"Authorized"}}' <call> --from alice

# After (shorthand)
dot tx.Utility.dispatch_as 'system(Authorized)' <call> --from alice
```

The syntax supports:

| Input | Result |
|---|---|
| `Root` | `{ type: "Root" }` (plain variant, already worked) |
| `Root()` | `{ type: "Root" }` (empty parens, same as above) |
| `Parachain(1000)` | `{ type: "Parachain", value: 1000 }` |
| `system(Authorized)` | `{ type: "system", value: { type: "Authorized" } }` |
| `system(Signed(5FHn...))` | nested 3 levels deep |
| `AccountId32({"id":"0x..."})` | JSON inside parens for struct values |

Variant matching is case-insensitive — `system(authorized)` resolves the outer variant to `system` and the inner to `Authorized` using the chain's metadata. All existing formats (JSON objects, hex, SS58 addresses) continue to work unchanged.

### Encode call data

Encode a call to hex without signing or submitting. This is useful for preparing calls to pass to `Sudo.sudo`, multisig proposals, governance preimages, or any workflow that needs raw call bytes. Works offline from cached metadata and does not require `--from`.

```
# Encode a remark
dot tx.System.remark 0xdeadbeef --encode

# Encode a transfer
dot tx.Balances.transfer_keep_alive 5FHneW46... 1000000000000 --encode

# Compose: encode a call, then wrap it with Sudo.sudo
dot tx.Sudo.sudo $(dot tx.System.remark 0xcafe --encode) --from alice
```

`--encode` and `--dry-run` are mutually exclusive. `--encode` cannot be used with raw call hex (it is already encoded).

### Decode call data to YAML / JSON

Decode a hex-encoded call into a YAML or JSON file that is compatible with [file-based commands](#file-based-commands). This is useful for inspecting opaque call data, sharing human-readable transaction definitions, or editing parameters before re-submitting. Works offline from cached metadata and does not require `--from`.

```
# Decode a raw hex call to YAML
dot tx.0x0001076465616462656566 --to-yaml

# Decode a raw hex call to JSON
dot tx.0x0001076465616462656566 --to-json

# Encode a named call and output as YAML
dot tx.System.remark 0xdeadbeef --to-yaml

# Round-trip: encode to hex, decode to YAML, re-encode from file
dot tx.System.remark 0xdeadbeef --encode              # 0x0001076465616462656566
dot tx.0x0001076465616462656566 --to-yaml > remark.yaml
dot ./remark.yaml --encode                             # same hex
```

`--to-yaml` / `--to-json` are mutually exclusive with each other and with `--encode` and `--dry-run`.

### Transaction output

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

### Exit codes

The CLI exits with code **1** when a finalized transaction has a dispatch error (e.g. insufficient balance, bad origin). The full transaction output (events, explorer links) is still printed before the error so you can debug the failure. Module errors are formatted as `PalletName.ErrorVariant` (e.g. `Balances.InsufficientBalance`).

```
dot tx.Balances.transferKeepAlive 5FHneW46... 999999999999999999 --from alice
# ... events and explorer links ...
# Error: Transaction dispatch error: Balances.InsufficientBalance
echo $?  # 1
```

This makes it easy to detect on-chain failures in scripts and CI pipelines.

### Argument parsing errors

When a call argument is invalid, the CLI shows a contextual error message with the argument name, the expected type, and a hint:

```
dot tx.Balances.transferKeepAlive 5GrwvaEF... abc --encode
# Error: Invalid value for argument 'value' (expected Compact<u128>): "abc"
#   Hint: Compact<u128>
```

For struct-based calls (most extrinsics), the error identifies the specific field that failed. For tuple-based calls, it shows the argument index. The original parse error is preserved as the `cause` for programmatic access.

### Wait level

By default, `dot tx` waits for finalization (~30s on Polkadot). Use `--wait` / `-w` to return earlier:

```
# Return as soon as the tx is broadcast (fastest)
dot tx.System.remark 0xdead --from alice --wait broadcast

# Return when included in a best block
dot tx.System.remark 0xdead --from alice -w best-block
dot tx.System.remark 0xdead --from alice -w best    # alias

# Wait for finalization (default, unchanged)
dot tx.System.remark 0xdead --from alice --wait finalized
dot tx.System.remark 0xdead --from alice             # same
```

| Level | Resolves when | Events shown | Explorer links |
|-------|---------------|:---:|:---:|
| `broadcast` | Tx is broadcast to the network | — | — |
| `best-block` / `best` | Tx is included in a best block | yes | yes |
| `finalized` (default) | Tx is finalized | yes | yes |

The `--wait` flag is silently ignored when combined with `--dry-run` or `--encode` (both return before submission).

### Custom signed extensions

Chains with non-standard signed extensions (e.g. `people-preview`) are auto-handled:

- `void` → empty bytes
- `Option<T>` → `None`
- enum with `Disabled` variant → `Disabled`

For manual override, use `--ext` with a JSON object:

```
dot tx.System.remark 0xdeadbeef --from alice \
  --ext '{"MyExtension":{"value":"..."}}'
```

### Transaction options

Override low-level transaction parameters. Useful for rapid-fire submission (custom nonce), priority fees (tip), or controlling transaction lifetime (mortality).

| Flag | Value | Description |
|------|-------|-------------|
| `--nonce <n>` | non-negative integer | Override the auto-detected nonce |
| `--tip <amount>` | non-negative integer (planck) | Priority tip for the transaction pool |
| `--mortality <spec>` | `immortal` or period (min 4) | Transaction mortality window |
| `--at <block>` | 0x-prefixed block hash | Block hash to validate against (defaults to finalized) |

```
# Fire-and-forget: submit two txs in rapid succession with manual nonces
dot tx.System.remark 0xdead --from alice --nonce 0 --wait broadcast
dot tx.System.remark 0xbeef --from alice --nonce 1 --wait broadcast

# Add a priority tip (in planck)
dot tx.Balances.transferKeepAlive 5FHneW46... 1000000000000 --from alice --tip 1000000

# Submit an immortal transaction (no expiry)
dot tx.System.remark 0xdead --from alice --mortality immortal

# Set a custom mortality period (rounds up to nearest power of two)
dot tx.System.remark 0xdead --from alice --mortality 128

# Validate against a specific block hash
dot tx.System.remark 0xdead --from alice --at 0x1234...abcd

# Combine: rapid-fire with tip and broadcast-only
dot tx.System.remark 0xdead --from alice --nonce 5 --tip 500000 --wait broadcast
```

When set, nonce / tip / mortality / at are shown in both `--dry-run` and submission output. These flags are silently ignored with `--encode`, `--to-yaml`, and `--to-json` (which return before signing).

## File-Based Commands

Run any `dot` command from a YAML or JSON file instead of typing complex arguments inline. This is especially useful for XCM messages and other deeply nested call data.

### File format

Files use a required category wrapper (`tx`, `query`, `const`, or `apis`) with an optional `chain` field:

```yaml
chain: people-paseo          # optional, overridable with --chain
tx:                           # category: tx, query, const, or apis
  PolkadotXcm:               # pallet name
    send:                     # call / storage item / constant / api method
      dest: ...               # arguments (named or positional)
      message: ...
```

### Running from a file

```bash
# Run a transaction from a YAML file
dot ./transfer.xcm.yaml --from alice --dry-run

# Encode only (no signing)
dot ./transfer.xcm.yaml --encode

# Override the chain from the file
dot ./transfer.xcm.yaml --chain kusama --from alice

# JSON files also work
dot ./remark.json --encode
```

All existing flags work: `--from`, `--dry-run`, `--encode`, `--to-yaml`, `--to-json`, `--json`, `--chain`, `--output`, `--wait`, `--ext`, etc.

### Variable substitution

Files support shell-style `${VAR}` placeholders with optional defaults via `${VAR:-default}`.

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

Variables are resolved in this order (first match wins):

1. `--var KEY=VALUE` flags (highest priority)
2. Environment variables
3. `vars:` section in the file (defaults)

```bash
# Uses defaults from vars section
dot ./transfer.yaml --from alice

# Override with --var
dot ./transfer.yaml --var AMOUNT=2000000000000 --from alice

# Override via environment
AMOUNT=5000000000000 dot ./transfer.yaml --from alice
```

Hex values passed via `--var` are preserved as-is, including leading zeros. This is important for encoded call data in XCM `Transact` instructions or similar byte-array fields:

```bash
# Encode a remark, then embed it in an XCM Transact via --var
CALL=$(dot tx.System.remark 0xdead --encode)
dot ./xcm-transact.yaml --var CALL=$CALL --encode
```

### Examples for each category

**Transaction (tx):**

```yaml
tx:
  System:
    remark:
      - "0xdeadbeef"
```

**Storage query:**

```yaml
chain: polkadot
query:
  System:
    Account:
      - "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
```

**Constant lookup:**

```yaml
chain: polkadot
const:
  Balances:
    ExistentialDeposit:
```

**Runtime API call:**

```yaml
chain: polkadot
apis:
  Core:
    version:
```

### XCM transfer examples

File-based commands are especially useful for XCM transfers. The following examples use `polkadot-asset-hub` as the source chain.

**Teleport DOT** from Asset Hub to the Polkadot relay chain (1 DOT = 10,000,000,000 planck):

```yaml
# teleport-dot.xcm.yaml — Teleport 1 DOT to relay chain
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

**Reserve transfer USDC** from Asset Hub to Hydration (parachain 2034). USDC is asset ID 1337 on Asset Hub with 6 decimals (10 USDC = 10,000,000):

```yaml
# reserve-transfer-usdc.xcm.yaml — Reserve transfer 10 USDC to Hydration
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

**Remote execution** via `PolkadotXcm.send` — see [`transfer.xcm.yaml`](transfer.xcm.yaml) for a full example that constructs an XCM program with `WithdrawAsset`, `BuyExecution`, `Transact`, `RefundSurplus`, and `DepositAsset`.

```bash
# Teleport DOT
dot ./teleport-dot.xcm.yaml --from alice --dry-run

# Reserve transfer USDC
dot ./reserve-transfer-usdc.xcm.yaml --from alice --dry-run

# Encode without submitting
dot ./teleport-dot.xcm.yaml --encode
```

> **Teleport vs reserve transfer**: Teleports burn assets on the source and mint on the destination — used between chains that trust each other (e.g. Asset Hub and the relay chain). Reserve transfers lock assets on the source (the reserve) and mint derivatives on the destination — used for assets like USDC where Asset Hub holds the real tokens.

### File detection

A first argument is treated as a file when it:

- Ends with `.json`, `.yaml`, or `.yml`
- Starts with `./` or `/`

Otherwise, the normal dot-path syntax is used.

## Hash

Compute cryptographic hashes commonly used in Substrate. Runs offline — no chain connection required.

### Supported algorithms

| Algorithm | Output | Description |
|-----------|--------|-------------|
| `blake2b256` | 32 bytes | BLAKE2b with 256-bit output |
| `blake2b128` | 16 bytes | BLAKE2b with 128-bit output |
| `keccak256` | 32 bytes | Keccak-256 (Ethereum-compatible) |
| `sha256` | 32 bytes | SHA-256 |

### Hash inline data

Pass hex-encoded bytes (with `0x` prefix) or plain text (UTF-8 encoded):

```
dot hash blake2b256 0xdeadbeef
dot hash sha256 hello
```

### Hash a file

Read raw file contents and hash them:

```
dot hash keccak256 --file ./data.bin
```

### Hash from stdin

Pipe data into the hash command:

```
echo -n "hello" | dot hash sha256 --stdin
```

### JSON output

```
dot hash blake2b256 0xdeadbeef --json
```

Run `dot hash` with no arguments to see all available algorithms and examples.

## Sign

Sign arbitrary messages with an account keypair. Output is a `Sr25519(0x...)` value directly usable as a `MultiSignature` enum argument in transaction calls. Runs offline — no chain connection required.

### Sign inline data

Pass hex-encoded bytes (with `0x` prefix) or plain text (UTF-8 encoded):

```
dot sign "hello world" --from alice
dot sign 0xdeadbeef --from alice
```

Output shows the crypto type, message bytes, raw signature, and an `Enum` value directly pasteable into tx arguments:

```
  Type:       Sr25519
  Message:    0xdeadbeef
  Signature:  0xabcdef...
  Enum:       Sr25519(0xabcdef...)
```

### Sign a file

Read raw file contents and sign them:

```
dot sign --file ./payload.bin --from alice
```

### Sign from stdin

Pipe data into the sign command:

```
echo -n "hello" | dot sign --stdin --from alice
```

### JSON output

```
dot sign "hello" --from alice --json
```

Returns a JSON object with `type`, `message`, `signature`, and `enum` fields.

### Signature type

The `--type` flag selects the signature algorithm (default: `sr25519`):

```
dot sign "hello" --from alice --type sr25519
```

Currently only `sr25519` is supported. Additional types (ed25519, ecdsa) may be added in future releases.

### Use with transactions

The `enum` value in the output is directly pasteable as a `MultiSignature` enum argument. For example, to produce the `candidate_signature` for `PeopleLite.attest`:

```
# 1. Construct the message bytes (prefix + encoded candidate + encoded ring_vrf_key)
# 2. Sign with the candidate's account
dot sign 0x<message_hex> --from candidate-account

# 3. Pass the Enum value as the candidate_signature argument
dot tx.PeopleLite.attest <candidate> Sr25519(0x...) <ring_vrf_key> ...
```

## Parachain Sovereign Accounts

Derive the sovereign account addresses for a parachain. Runs offline — no chain connection required.

Every parachain has two types of sovereign account:

- **Child** — the account a parachain has on the relay chain. Uses the `"para"` prefix (`0x70617261`).
- **Sibling** — the account a parachain has on another parachain. Uses the `"sibl"` prefix (`0x7369626c`).

These accounts are deterministic: the 32-byte account ID is constructed as `prefix (4 bytes) + paraId as little-endian u32 (4 bytes) + zero padding (24 bytes)`.

### Show both accounts

```
dot parachain 1000
```

Output:

```
Parachain 1000 — Sovereign Accounts

  Child:
    Public Key:  0x70617261e8030000000000000000000000000000000000000000000000000000
    SS58:        5Ec4AhPZk8STuex8Wsi9TwDtJQxKqzPJRCH7348Xtcs9vZLJ
    Prefix:      42

  Sibling:
    Public Key:  0x7369626ce8030000000000000000000000000000000000000000000000000000
    SS58:        5Eg2fntNprdN3FgH4sfEaaZhYtddZQSQUqvYJ1f2mLtinVhV
    Prefix:      42
```

### Filter by type

```
dot parachain 2004 --type child
dot parachain 2004 --type sibling
```

### Custom SS58 prefix

Use `--prefix` to encode the address for a specific network (e.g., `0` for Polkadot, `2` for Kusama):

```
dot parachain 1000 --prefix 0
```

### JSON output

```
dot parachain 1000 --json
```

```json
{
  "paraId": 1000,
  "prefix": 42,
  "child": {
    "publicKey": "0x70617261e8030000000000000000000000000000000000000000000000000000",
    "ss58": "5Ec4AhPZk8STuex8Wsi9TwDtJQxKqzPJRCH7348Xtcs9vZLJ"
  },
  "sibling": {
    "publicKey": "0x7369626ce8030000000000000000000000000000000000000000000000000000",
    "ss58": "5Eg2fntNprdN3FgH4sfEaaZhYtddZQSQUqvYJ1f2mLtinVhV"
  }
}
```

Run `dot parachain` with no arguments to see usage and examples.

## Bandersnatch Member Keys

Derive Bandersnatch member keys from account mnemonics for on-chain member set registration. Uses the [`verifiablejs`](https://github.com/paritytech/verifiablejs) WASM library (Ring VRF on the Bandersnatch elliptic curve). Runs offline — no chain connection required.

### How it works

The derivation converts a BIP39 mnemonic into a 32-byte Bandersnatch public key ("member key") that can be registered in on-chain member sets for anonymous membership proofs:

```
Mnemonic (12 or 24 words)
    │  mnemonicToEntropy()  (raw BIP39 entropy, NOT miniSecret)
    ▼
blake2b256(entropy, context?)   keyed or unkeyed
    ▼
member_from_entropy()           verifiablejs WASM (Bandersnatch curve)
    ▼
32-byte member key              for on-chain member set registration
```

- **Unkeyed** (no `--context`): `blake2b256(entropy)` — the blake2b key parameter is omitted
- **With context** (e.g. `--context candidate`): `blake2b256(entropy, key="candidate")` — the `--context` value is passed as the raw UTF-8 bytes of the blake2b key parameter

These produce different member keys from the same mnemonic. The unkeyed derivation is used for lite person registration, while the `candidate` context is used for full person registration.

### Derive a member key

```
# Unkeyed derivation (lite person)
dot verifiable alice

# With "candidate" context (full person)
dot verifiable alice --context candidate

# Arbitrary context string
dot verifiable alice --context pps
```

Output:

```
Bandersnatch Member Key

  Account:    alice
  Context:    candidate
  Member Key: 0x2fd5b74033d904cf5575b932507939c5d43811e488223229eaf5596565f15ae6
```

When `--context` is omitted, the "Context:" line is not shown.

### JSON output

```
dot verifiable alice --context candidate --json
```

```json
{
  "account": "alice",
  "memberKey": "0x2fd5b74033d904cf5575b932507939c5d43811e488223229eaf5596565f15ae6",
  "context": "candidate"
}
```

### Saved keys

Derived keys are automatically saved to the account store for stored accounts. They appear in `dot account inspect` output:

```
Account Info

  Name:             my-account
  Public Key:       0x44a9...eb0f
  SS58:             5DfhGyQ...
  Bandersnatch:     0xabc1...
               (candidate) 0xdef2...
  Prefix:           42
```

When creating a new account with `dot account create`, both unkeyed and `candidate` keys are automatically derived and saved. For dev accounts (alice, bob, etc.), use `dot verifiable` directly to derive keys.

### Requirements

- Account must have a BIP39 mnemonic (not a hex seed or watch-only)
- Dev accounts share the same mnemonic and therefore produce the same Bandersnatch keys
- Both 12-word and 24-word mnemonics are supported — blake2b256 normalizes any input to 32 bytes

Run `dot verifiable` with no arguments to see usage, examples, and the full derivation diagram.

## Shell Completions

Generate shell completion scripts for tab-completing subcommands, chain names, pallet names, and item names. Completions use cached metadata — no network calls are made.

### Setup

```
# zsh — add to ~/.zshrc
eval "$(dot completions zsh)"

# bash — add to ~/.bashrc
eval "$(dot completions bash)"

# fish — save to completions directory
dot completions fish > ~/.config/fish/completions/dot.fish
```

Then restart your shell or source the config file.

### What completes

Once installed, press Tab to complete at any point:

```
dot qu<Tab>              # → query
dot query.<Tab>          # → query.System, query.Balances, ...
dot query.System.<Tab>   # → query.System.Account, query.System.Number, ...
dot apis.<Tab>           # → apis.Core, apis.Metadata, ...
dot apis.Core.<Tab>      # → apis.Core.version, ...
dot polkadot.<Tab>       # → polkadot.query, polkadot.tx, ..., polkadot.apis
dot polkadot.query.<Tab> # → polkadot.query.System, ...
dot --chain <Tab>        # → polkadot, paseo, ...
dot --from <Tab>         # → alice, bob, ..., stored account names
dot --output <Tab>       # → pretty, json
dot chain <Tab>          # → add, remove, update, list, default
dot account <Tab>        # → create, import, derive, list, remove, ...
dot hash <Tab>           # → blake2b256, blake2b128, keccak256, sha256
```

Completions are context-aware:

- `query.` shows only pallets with storage items
- `tx.` shows only pallets with calls
- `const.` shows only pallets with constants
- `events.` shows only pallets with events
- `errors.` shows only pallets with errors
- `apis.` shows runtime API names
- `--` after a tx dotpath includes `--from`, `--dry-run`, `--encode`, `--wait`
- `--` after a query dotpath includes `--dump`

Chain prefix paths work at any depth: `polkadot.query.System.Account` completes each segment individually.

### How it works

The shell completion script calls a hidden `dot __complete` command on every Tab press. This command loads config and cached metadata from `~/.polkadot/` (no network), generates candidates, and prints them to stdout. The shell then presents the matches.

If metadata is not cached for a chain, pallet and item completions are skipped — categories, commands, and chain names still complete.

## Getting Help

Every command supports `--help` to show its detailed usage, available actions, and examples:

```
dot --help              # global help with all commands
dot account --help      # same as `dot account` — shows account actions
dot chain --help        # same as `dot chain` — shows chain actions
dot hash --help         # same as `dot hash` — shows algorithms and examples
```

### Item-level help

Use `--help` on any fully-qualified dot-path to see metadata detail (argument types, documentation) and category-specific usage hints. This works entirely offline from cached metadata — no chain connection required.

```
dot tx.System.remark --help
```

```
── System.remark (Call) ──

  Args: (remark: Vec<u8>)

  Make some on-chain remark.

Usage:
  dot tx.System.remark --from <account>
  dot tx.System.remark --encode

Options:
  --from <name>    Account to sign with
  --dry-run        Estimate fees without submitting
  --encode         Encode call to hex without signing
  --ext <json>     Custom signed extension values as JSON
  -w, --wait       Resolve at: broadcast, best-block, finalized (default)
```

Other categories work the same way:

```
dot query.System.Account --help           # storage type, key/value info, query options
dot const.Balances.ExistentialDeposit --help  # constant type and docs
dot events.Balances.Transfer --help       # event fields and docs
dot errors.Balances.InsufficientBalance --help  # error docs
dot apis.Core.version --help             # runtime API method signature and docs
```

For `tx` commands, omitting both `--from` and `--encode` shows this same help output instead of an error — so you can explore calls without remembering the exact flags:

```
dot tx.System.remark 0xdead               # shows call help (no error)
```

## Global Options

These flags work with any command:

| Flag | Description |
|------|-------------|
| `--help` | Show help (global or command-specific) |
| `--chain <name>` | Target chain (default from config) |
| `--rpc <url>` | Override RPC endpoint(s) for this call (repeat for fallback) |

| `--json` | Structured JSON output (shorthand for `--output json`) |
| `--output json` | Structured JSON output |
| `--dump` | Dump all entries of a storage map (required for keyless map queries) |
| `-w, --wait <level>` | Tx wait level: `broadcast`, `best-block` / `best`, `finalized` (default) |

### Structured JSON output

Every command supports `--json` for machine-readable output. This works on data queries, metadata inspection, account management, chain configuration, and transaction submission:

```
dot inspect --json                          # All pallets as JSON
dot inspect Balances --json                 # Pallet detail with storage, constants, calls, events, errors
dot chain list --json                       # Configured chains
dot account list --json                     # Dev and stored accounts
dot account create my-key --json            # New account details (mnemonic warning on stderr)
dot tx.System.remark 0xdead --encode --json # Encoded call hex wrapped in JSON
dot events.Balances --json                  # Event listing with field signatures
dot const.System --json                     # Constant listing with types
```

For transaction submission, `--json` emits NDJSON (one JSON object per lifecycle event):

```
dot tx.System.remark 0xdead --from alice --json
# {"event":"signed","txHash":"0x..."}
# {"event":"broadcasted","txHash":"0x..."}
# {"event":"finalized","blockNumber":123,"blockHash":"0x...","ok":true,"events":[...]}
```

### Pipe-safe output

All commands follow Unix conventions: **data goes to stdout, progress goes to stderr**. This means you can safely pipe `--json` into `jq` or other tools without progress messages ("Fetching metadata...", spinner output, "Connecting...") corrupting the data stream:

```
dot const.System.SS58Prefix --json | jq '.+1'
dot query.System.Number --json | jq
dot chain list --json | jq '.chains[].name'
dot account list --json | jq '.stored[].address'
dot inspect --json | jq '.pallets[] | select(.events > 10) | .name'
```

In an interactive terminal, both streams render together so you see progress and results normally.

## Update Notifications

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

## Environment Compatibility

The CLI works in Node.js (v22+), Bun, and sandboxed runtimes (e.g. LLM tool-use / MCP environments). WebSocket connections use the native `WebSocket` implementation provided by the runtime — no external WebSocket package is required.

## Configuration

Config and metadata caches live in `~/.polkadot/`:

```
~/.polkadot/
├── config.json          # chains and default chain
├── accounts.json        # stored accounts
├── update-check.json    # cached update check result
└── chains/
    └── polkadot/
        └── metadata.bin # cached SCALE-encoded metadata
```
