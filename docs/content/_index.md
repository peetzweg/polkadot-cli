# polkadot-cli

A command-line tool for interacting with Polkadot-ecosystem chains. Manage chains and accounts, query storage, look up constants, inspect metadata, submit extrinsics, and compute hashes — all from your terminal. [View on GitHub](https://github.com/peetzweg/polkadot-cli).

## Install

Install globally via npm:

```
npm install -g polkadot-cli@latest
```

This installs the `dot` command globally. Ships with Polkadot and all system parachains preconfigured with multiple fallback RPC endpoints. Add any Substrate-based chain by pointing to its RPC endpoint(s).

## Chains

Manage chain connections. Polkadot is configured by default along with all system parachains for both Polkadot and Paseo networks. Add any Substrate-based chain by RPC endpoint or Smoldot light client.

### Preconfigured chains

The following chains are available out of the box — no `dot chain add` needed:

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

Each chain ships with multiple RPC endpoints from decentralized infrastructure providers (IBP, Dotters, Dwellir, and others). The CLI automatically falls back to the next endpoint if the primary is unreachable. Use `dot chain list` to see all endpoints for each chain.

### Add a chain

Connect to a chain via WebSocket RPC or the embedded Smoldot light client. Use repeated `--rpc` flags to configure multiple endpoints with automatic fallback — if the primary is unreachable, the CLI tries the next one:

```
# Single RPC
dot chain add kusama --rpc wss://kusama-rpc.polkadot.io

# Multiple RPCs with fallback
dot chain add kusama --rpc wss://kusama-rpc.polkadot.io --rpc wss://kusama-rpc.dwellir.com

# Light client
dot chain add westend --light-client
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

### Import an account

Import from a BIP39 mnemonic or raw hex seed:

```
dot account import treasury --secret "word1 word2 ... word12"
dot account import raw-key --secret 0xabcdef...
```

`add` is an alias for `import`. Use `--path` to import with a derivation path:

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

`account list` shows the derivation path next to the account name:

```
  treasury-staking (//staking)  5FHneW46...
  ci-signer (//ci) (env: MY_SECRET)  5EPCUjPx...
```

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
dot account inspect alice --output json
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

## Query

Read on-chain storage using dot-path syntax: `dot query.Pallet.Item`. Fetch plain values, look up map entries by key, or enumerate all entries. Use `dot query` to list pallets with storage items, or `dot query.Pallet` to list a pallet's storage items.

```
# Plain storage value
dot query.System.Number

# Map entry by key
dot query.System.Account 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY

# All map entries (default limit: 100)
dot query.System.Account --limit 10

# Pipe-safe — stdout is clean data, progress messages go to stderr
dot query.System.Account --limit 5 | jq '.[0].value.data.free'
dot query.System.Number --output json | jq '.+1'

# Query a specific chain using chain prefix
dot kusama.query.System.Account 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY

# List pallets with storage items
dot query

# List storage items in a pallet
dot query.System
```

### Output formatting

Query results automatically convert on-chain types for readability:

- **BigInt** values (e.g. balances) render as decimal strings
- **Binary** fields (e.g. token `name`, `symbol`) render as text when valid UTF-8, or as `0x`-prefixed hex otherwise
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
dot const.Balances.ExistentialDeposit --output json | jq
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

Each category supports partial paths for browsing metadata. Category-only invocations list pallets; pallet-level invocations list items; item-level invocations show detail. All support `--chain <name>`, `--rpc <url>`, and chain prefix syntax. Singular and plural aliases work: `event` = `events`, `error` = `errors`.

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
dot query.System.Account                   # storage detail (fetches value)
```

### Constants (const listing)

```
dot const                                  # list pallets with constants
dot const.Balances                         # list constants (offline)
dot const.Balances.ExistentialDeposit      # look up value (connects to chain)
```

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

Use `Utility.batchAll` to combine multiple calls into one transaction:

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
dot hash blake2b256 0xdeadbeef --output json
```

Run `dot hash` with no arguments to see all available algorithms and examples.

## Getting Help

Every command supports `--help` to show its detailed usage, available actions, and examples:

```
dot --help              # global help with all commands
dot account --help      # same as `dot account` — shows account actions
dot chain --help        # same as `dot chain` — shows chain actions
dot hash --help         # same as `dot hash` — shows algorithms and examples
```

## Global Options

These flags work with any command:

| Flag | Description |
|------|-------------|
| `--help` | Show help (global or command-specific) |
| `--chain <name>` | Target chain (default from config) |
| `--rpc <url>` | Override RPC endpoint(s) for this call (repeat for fallback) |
| `--light-client` | Use Smoldot light client |
| `--output json` | Raw JSON output (default: pretty) |
| `--limit <n>` | Max entries for map queries (0 = unlimited, default: 100) |

### Pipe-safe output

All commands follow Unix conventions: **data goes to stdout, progress goes to stderr**. This means you can safely pipe `--output json` into `jq` or other tools without progress messages ("Fetching metadata...", spinner output, "Connecting...") corrupting the data stream:

```
dot const.System.SS58Prefix --output json | jq '.+1'
dot query.System.Number --output json | jq
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
