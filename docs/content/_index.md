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
dot chain list
```

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
dot account list
```

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

### Remove an account

```
dot account remove my-validator
```

## Query

Read on-chain storage. Specify a `Pallet.Item` to fetch a plain value, or pass a key for map lookups. Omit the key to enumerate map entries.

```
# Plain storage value
dot query System.Number

# Map entry by key
dot query System.Account 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY

# All map entries (default limit: 100)
dot query System.Account --limit 10

# Pipe to jq (colors disabled automatically)
dot query System.Account --limit 5 | jq '.[0].value.data.free'
```

## Constants

Look up runtime constants by `Pallet.Constant`:

```
dot const Balances.ExistentialDeposit
dot const System.SS58Prefix --chain kusama
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

### Transaction output

Both dry-run and submission display the encoded call hex and a decoded human-readable form:

```
  Call:   0x0001076465616462656566
  Decode: System.remark(remark: 0xdeadbeef)
  Tx:     0xabc123...
  Block:  #12345678 (0xdef...)
  Status: ok
```

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

## Configuration

Config and metadata caches live in `~/.polkadot/`:

```
~/.polkadot/
├── config.json          # chains and default chain
├── accounts.json        # stored accounts
└── chains/
    └── polkadot/
        └── metadata.bin # cached SCALE-encoded metadata
```
