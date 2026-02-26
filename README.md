# polkadot-cli

A command-line tool for interacting with Polkadot-ecosystem chains. Manage chains and accounts, query storage, look up constants, inspect metadata, and submit extrinsics — all from your terminal.

Ships with Polkadot as the default chain. Add any Substrate-based chain by pointing to its RPC endpoint.

## Install

```bash
npm install -g polkadot-cli@latest
```

This installs the `dot` command globally.

## Usage

### Manage chains

```bash
# Add a chain
dot chain add kusama --rpc wss://kusama-rpc.polkadot.io
dot chain add westend --light-client

# List configured chains
dot chain list

# Re-fetch metadata after a runtime upgrade
dot chain update          # updates default chain
dot chain update kusama   # updates a specific chain

# Set default chain
dot chain default kusama

# Remove a chain
dot chain remove westend
```

### Manage accounts

Dev accounts (Alice, Bob, Charlie, Dave, Eve, Ferdie) are always available for testnets. Create or import your own accounts for any chain.

```bash
# List all accounts (dev + stored)
dot account list

# Create a new account (generates a mnemonic)
dot account create my-validator

# Import from a BIP39 mnemonic
dot account import treasury --secret "word1 word2 ... word12"

# Import from a hex seed
dot account import raw-key --secret 0xabcdef...

# Remove an account
dot account remove my-validator
```

### Query storage

```bash
# Plain storage value
dot query System.Number

# Map entry by key
dot query System.Account 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY

# All map entries (default limit: 100)
dot query System.Account --limit 10

# Pipe to jq (colors disabled automatically)
dot query System.Account --limit 5 | jq '.[0].value.data.free'
```

### Look up constants

```bash
dot const Balances.ExistentialDeposit
dot const System.SS58Prefix --chain kusama
```

### Inspect metadata

Works offline from cached metadata after the first fetch.

```bash
# List all pallets
dot inspect

# List a pallet's storage items and constants
dot inspect System

# Detailed type info for a specific item
dot inspect System.Account
```

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

# Batch multiple transfers with Utility.batchAll
dot tx Utility.batchAll '[{"type":"Balances","value":{"type":"transfer_keep_alive","value":{"dest":"5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty","value":1000000000000}}},{"type":"Balances","value":{"type":"transfer_keep_alive","value":{"dest":"5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y","value":2000000000000}}}]' --from alice
```

Both dry-run and submission display the encoded call hex and a decoded human-readable form:

```
  Call:   0x0001076465616462656566
  Decode: System.remark(remark: 0xdeadbeef)
  Tx:     0xabc123...
  Block:  #12345678 (0xdef...)
  Status: ok
```

#### Custom signed extensions

Chains with non-standard signed extensions (e.g. `people-preview`) are auto-handled:

- `void` → empty bytes
- `Option<T>` → `None`
- enum with `Disabled` variant → `Disabled`

For manual override, use `--ext` with a JSON object:

```bash
dot tx System.remark 0xdeadbeef --from alice --ext '{"MyExtension":{"value":"..."}}'
```

### Global options

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
├── accounts.json        # stored accounts (secrets encrypted at rest — coming soon)
└── chains/
    └── polkadot/
        └── metadata.bin # cached SCALE-encoded metadata
```

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
