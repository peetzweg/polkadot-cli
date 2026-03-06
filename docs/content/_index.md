# polkadot-cli

A command-line tool for interacting with Polkadot-ecosystem chains. Manage chains and accounts, query storage, look up constants, inspect metadata, submit extrinsics, and compute hashes — all from your terminal. [View on GitHub](https://github.com/peetzweg/polkadot-cli).

## Install

Install globally via npm:

```
npm install -g polkadot-cli@latest
```

This installs the `dot` command globally. Ships with Polkadot as the default chain. Add any Substrate-based chain by pointing to its RPC endpoint.

## Chains

Manage chain connections. Polkadot is configured by default. Add any Substrate-based chain by RPC endpoint or Smoldot light client.

### Add a chain

Connect to a chain via WebSocket RPC or the embedded Smoldot light client:

```
dot chain add kusama --rpc wss://kusama-rpc.polkadot.io
dot chain add westend --light-client
```

### List chains

Show all configured chains and which one is the default:

```
dot chains
dot chain list
```

Both forms are equivalent. `dot chains` is a shorthand that skips the `list` subcommand. Running `dot chain` with no action also lists chains.

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

Both forms are equivalent. `dot accounts` is a shorthand that skips the `list` subcommand. Running `dot account` with no action also lists accounts.

### Create an account

Generate a new BIP39 mnemonic and store the account:

```
dot account create my-validator
```

### Import an account

Import from a BIP39 mnemonic or raw hex seed:

```
dot account import treasury --secret "word1 word2 ... word12"
dot account import raw-key --secret 0xabcdef...
```

### Add an env-var-backed account

Store a reference to an environment variable instead of the secret itself. The secret never touches disk — ideal for CI/CD pipelines and security-conscious workflows:

```
dot account add ci-signer --env MY_SECRET
```

At signing time, the CLI reads `$MY_SECRET` and derives the keypair. If the variable is not set, the CLI errors with a clear message.

`account list` shows an `(env: MY_SECRET)` badge and resolves the address live when the variable is available:

```
dot accounts
# ci-signer (env: MY_SECRET)  5EPCUjPx...
```

Use the account like any other:

```
MY_SECRET="word1 word2 ..." dot tx System.remark 0xdead --from ci-signer
```

### Remove an account

```
dot account remove my-validator
```

## Chain Prefix

Instead of the `--chain` flag, you can prefix any target with the chain name using dot notation:

```
dot query kusama.System.Account 5GrwvaEF...
dot const kusama.Balances.ExistentialDeposit
dot tx kusama.Balances.transferKeepAlive 5FHneW46... 1000000000000 --from alice
dot inspect kusama.System
dot inspect kusama.System.Account
```

The `--chain` flag and default chain still work as before. Using `Pallet.Item` without a prefix continues to target the default chain. If both a chain prefix and `--chain` flag are provided, the CLI errors with a clear message.

For `inspect`, a two-segment input like `kusama.System` is disambiguated by checking configured chain names. Chain names (lowercase, e.g. `kusama`) and pallet names (PascalCase, e.g. `System`) don't collide in practice. If they did, the chain prefix takes priority and `--chain` serves as an escape hatch.

## Query

Read on-chain storage. Specify a `Pallet.Item` to fetch a plain value, or pass a key for map lookups. Omit the key to enumerate map entries.

```
# Plain storage value
dot query System.Number

# Map entry by key
dot query System.Account 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY

# All map entries (default limit: 100)
dot query System.Account --limit 10

# Pipe to jq — stdout is clean JSON, no extra text
dot query System.Account --limit 5 | jq '.[0].value.data.free'
dot query System.Number --output json | jq '.+1'

# Query a specific chain using chain prefix
dot query kusama.System.Account 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
```

### Output formatting

Query results automatically convert on-chain types for readability:

- **BigInt** values (e.g. balances) render as decimal strings
- **Binary** fields (e.g. token `name`, `symbol`) render as text when valid UTF-8, or as `0x`-prefixed hex otherwise
- **Uint8Array** values render as `0x`-prefixed hex

```
# Token metadata — symbol and name display as text, not {}
dot query assethub-paseo.Assets.Metadata 50000413
# { "deposit": "6693666000", "name": "Paseo Token", "symbol": "PAS", ... }
```

## Constants

Look up runtime constants by `Pallet.Constant`:

```
dot const Balances.ExistentialDeposit
dot const System.SS58Prefix --chain kusama
dot const kusama.Balances.ExistentialDeposit

# Pipe to jq — stdout is clean JSON, no extra text
dot const Balances.ExistentialDeposit --output json | jq
```

## Inspect

Browse chain metadata offline (uses the cached copy after the first fetch).

```
# List all pallets
dot inspect

# List a pallet's storage items and constants
dot inspect System

# Detailed type info for a specific item
dot inspect System.Account

# Inspect a specific chain using chain prefix
dot inspect kusama.System
dot inspect kusama.System.Account
```

## Transactions

Build, sign, and submit extrinsics. Pass a `Pallet.Call` with arguments, or a raw SCALE-encoded call hex (e.g. from a multisig proposal or governance). Both forms display a decoded human-readable representation of the call.

### Basic usage

```
# Simple remark
dot tx System.remark 0xdeadbeef --from alice

# Transfer (amount in plancks)
dot tx Balances.transferKeepAlive 5FHneW46... 1000000000000 --from alice
```

### Dry run

Estimate fees without submitting:

```
dot tx Balances.transferKeepAlive 5FHneW46... 1000000000000 --from alice --dry-run
```

### Raw call data

Submit a raw SCALE-encoded call hex (e.g. from a multisig proposal or another tool):

```
dot tx 0x0503008eaf04151687736326c9fea17e25fc528761369... --from alice
```

### Batch calls

Use `Utility.batchAll` to combine multiple calls into one transaction:

```
dot tx Utility.batchAll '[
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
dot tx Utility.dispatch_as '{"type":"system","value":{"type":"Authorized"}}' <call> --from alice

# After (shorthand)
dot tx Utility.dispatch_as 'system(Authorized)' <call> --from alice
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
dot tx System.remark 0xdeadbeef --encode

# Encode a transfer
dot tx Balances.transfer_keep_alive 5FHneW46... 1000000000000 --encode

# Compose: encode a call, then wrap it with Sudo.sudo
dot tx Sudo.sudo $(dot tx System.remark 0xcafe --encode) --from alice
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

### Exit codes

The CLI exits with code **1** when a finalized transaction has a dispatch error (e.g. insufficient balance, bad origin). The full transaction output (events, explorer links) is still printed before the error so you can debug the failure. Module errors are formatted as `PalletName.ErrorVariant` (e.g. `Balances.InsufficientBalance`).

```
dot tx Balances.transferKeepAlive 5FHneW46... 999999999999999999 --from alice
# ... events and explorer links ...
# Error: Transaction dispatch error: Balances.InsufficientBalance
echo $?  # 1
```

This makes it easy to detect on-chain failures in scripts and CI pipelines.

### Custom signed extensions

Chains with non-standard signed extensions (e.g. `people-preview`) are auto-handled:

- `void` → empty bytes
- `Option<T>` → `None`
- enum with `Disabled` variant → `Disabled`

For manual override, use `--ext` with a JSON object:

```
dot tx System.remark 0xdeadbeef --from alice \
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

## Global Options

These flags work with any command:

| Flag | Description |
|------|-------------|
| `--chain <name>` | Target chain (default from config) |
| `--rpc <url>` | Override RPC endpoint for this call |
| `--light-client` | Use Smoldot light client |
| `--output json` | Raw JSON output (default: pretty) |
| `--limit <n>` | Max entries for map queries (0 = unlimited, default: 100) |

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

The version check runs in the background on startup and caches the result for 24 hours in `~/.polkadot/update-check.json`. It never blocks the CLI.

The notification is automatically suppressed when:

- `DOT_NO_UPDATE_CHECK=1` is set
- `CI` environment variable is set (any value)
- stdout is not a TTY (e.g. piped output)

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
