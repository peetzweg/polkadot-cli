# polkadot-cli

A command-line tool for interacting with Polkadot-ecosystem chains. Manage chains and accounts, query storage, look up constants, inspect metadata, submit extrinsics, and compute hashes — all from your terminal.

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
dot chains              # shorthand
dot chain list          # equivalent

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

> **Security warning:** Account secrets (mnemonics and seeds) are currently stored **unencrypted** in `~/.polkadot/accounts.json`. Do not use this for high-value accounts on mainnet. Encrypted storage is planned for a future release.

```bash
# List all accounts (dev + stored)
dot accounts            # shorthand
dot account list        # equivalent

# Create a new account (generates a mnemonic)
dot account create my-validator

# Import from a BIP39 mnemonic
dot account import treasury --secret "word1 word2 ... word12"

# Remove an account
dot account remove my-validator
```

**Supported secret formats for import:**

| Format | Example | Status |
|--------|---------|--------|
| BIP39 mnemonic (12/24 words) | `"abandon abandon ... about"` | Supported |
| Hex seed (`0x` + 64 hex chars) | `0xabcdef0123...` | Not supported via CLI (see below) |

**Known limitation:** Hex seed import (`--secret 0x...`) does not work from the command line. The CLI argument parser (`cac`) interprets `0x`-prefixed values as JavaScript numbers, which loses precision for 32-byte seeds. Use a BIP39 mnemonic instead. If you need to import a raw seed programmatically, write it directly to `~/.polkadot/accounts.json`.

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

Both dry-run and submission display the encoded call hex and a decoded human-readable form:

```
  Call:   0x0001076465616462656566
  Decode: System.remark(remark: 0xdeadbeef)
  Tx:     0xabc123...
  Status: ok
```

#### Exit codes

The CLI exits with code **1** when a finalized transaction has a dispatch error (e.g. insufficient balance, bad origin). The full transaction output (events, explorer links) is still printed before the error so you can debug the failure. Module errors are formatted as `PalletName.ErrorVariant` (e.g. `Balances.InsufficientBalance`).

```bash
dot tx Balances.transferKeepAlive 5FHneW46... 999999999999999999 --from alice
# ... events and explorer links ...
# Error: Transaction dispatch error: Balances.InsufficientBalance
echo $?  # 1
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

### Global options

| Flag | Description |
|------|-------------|
| `--chain <name>` | Target chain (default from config) |
| `--rpc <url>` | Override RPC endpoint for this call |
| `--light-client` | Use Smoldot light client |
| `--output json` | Raw JSON output (default: pretty) |
| `--limit <n>` | Max entries for map queries (0 = unlimited, default: 100) |

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
├── accounts.json        # stored accounts (⚠️ secrets are NOT encrypted — see below)
├── update-check.json    # cached update check result
└── chains/
    └── polkadot/
        └── metadata.bin # cached SCALE-encoded metadata
```

> **Warning:** `accounts.json` stores secrets (mnemonics and seeds) in **plain text**. Encrypted-at-rest storage is planned but not yet implemented. Keep appropriate file permissions (`chmod 600 ~/.polkadot/accounts.json`) and do not use this for high-value mainnet accounts.

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
