[![codecov](https://codecov.io/gh/peetzweg/polkadot-cli/branch/main/graph/badge.svg)](https://codecov.io/gh/peetzweg/polkadot-cli)

# polkadot-cli

A command-line tool for interacting with Polkadot-ecosystem chains. Manage chains and accounts, query storage, look up constants, inspect metadata, submit extrinsics, and compute hashes — all from your terminal.

Ships with Polkadot and all system parachains preconfigured with multiple fallback RPC endpoints. Add any Substrate-based chain by pointing to its RPC endpoint(s).

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

### Query storage

```bash
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

#### Output formatting

Query results automatically convert on-chain types for readability:

- **BigInt** values (e.g. balances) render as decimal strings
- **Binary** fields (e.g. token `name`, `symbol`) render as text when valid UTF-8, or as `0x`-prefixed hex otherwise
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

# Pipe to jq — stdout is clean JSON, no extra text
dot const Balances.ExistentialDeposit --output json | jq
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

# Inspect a specific chain using chain prefix
dot inspect kusama.System
dot inspect kusama.System.Account
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

### Getting help

Every command supports `--help` to show its detailed usage, available actions, and examples:

```bash
dot --help              # global help with all commands
dot account --help      # same as `dot account` — shows account actions
dot chain --help        # same as `dot chain` — shows chain actions
dot hash --help         # same as `dot hash` — shows algorithms and examples
```

### Global options

| Flag | Description |
|------|-------------|
| `--help` | Show help (global or command-specific) |
| `--chain <name>` | Target chain (default from config) |
| `--rpc <url>` | Override RPC endpoint(s) for this call (repeat for fallback) |
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
