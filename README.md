# polkadot-cli

A command-line tool for querying Polkadot-ecosystem on-chain state. Query storage, look up constants, and inspect chain metadata — all from your terminal.

Ships with Polkadot as the default chain. Add any Substrate-based chain by pointing to its RPC endpoint.

## Install

```bash
npm install -g polkadot-cli
```

This installs the `dot` command globally.

## Usage

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

### Manage chains

```bash
# Add a chain
dot chain add kusama --rpc wss://kusama-rpc.polkadot.io
dot chain add westend --light-client

# List configured chains
dot chain list

# Set default chain
dot chain default kusama

# Remove a chain
dot chain remove westend
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
