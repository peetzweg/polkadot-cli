---
name: dot-cli
description: >
  Guide for using the `dot` CLI (polkadot-cli) to interact with Polkadot/Substrate chains.
  Use when the user works with Substrate-based blockchains — querying storage, submitting
  transactions, calling runtime APIs, managing chain connections, or scripting multi-chain
  setups. Triggers: user mentions `dot` CLI, polkadot-cli, Substrate chain queries,
  extrinsic submission, runtime APIs, XCM, asset pools, or chain setup scripts using `dot`.
---

# dot CLI (polkadot-cli)

Unified CLI for Polkadot/Substrate chains. Install: `npm install -g polkadot-cli@latest`

## Core Pattern

```
dot [chain.]<category>[.Pallet[.Item]] [args] [options]
```

Categories: `query`, `tx`, `apis`, `const`, `events`, `errors`

Omit deeper levels to discover what's available:
```bash
dot query                          # list pallets with storage
dot query.Balances                 # list storage items
dot query.Balances.Account <addr>  # query specific item
dot apis                           # list runtime APIs
dot apis.XcmPaymentApi             # list methods
```

## Chain Management

```bash
dot chain add my-chain --rpc wss://rpc.example.com
dot chain list
dot chain default my-chain
```

Once registered, prefix any command: `dot my-chain.query.System.Number`

**Critical gotcha:** Always use registered chain aliases, not `--rpc`. The `--rpc` flag can silently resolve metadata from the wrong chain (known bug). Register first, then query:

```bash
# WRONG — may use cached metadata from a different chain
dot --rpc wss://example.com/asset-hub inspect

# CORRECT
dot chain add my-ah --rpc wss://example.com/asset-hub
dot my-ah.inspect
```

## Querying Storage

```bash
dot chain.query.System.Number                              # plain value
dot chain.query.System.Account <address>                   # map lookup
dot chain.query.AssetConversion.Pools --dump               # all map entries
dot chain.query.Assets.Metadata '{"parents":1,...}'        # complex key (JSON)
dot chain.query.System.Number --json                       # JSON output
```

### Handling `undefined` — Critical for Scripting

Queries return the literal string `undefined` (not valid JSON) when a key doesn't exist. Always guard before piping to `jq`:

```bash
RESULT=$(dot chain.query.Assets.Asset "$ID")
if [ "$RESULT" == "undefined" ]; then
  echo "not found"
fi
```

Three-way semantics:

| Substrate state | dot output | Meaning |
|---|---|---|
| Key has value | `{...}` / `"..."` / number | Normal result |
| Key exists, value is None | `null` | Option::None |
| Key doesn't exist | `undefined` | Storage key absent |

**u128 / big numbers** are returned as quoted strings (`"1000000000000000000"`) due to JS precision limits. Strip quotes for bash comparison: `VALUE=$(... | tr -d '"')`

## Submitting Transactions

```bash
dot chain.tx.Balances.transfer_keep_alive <dest> <amount> --from alice
dot chain.tx.System.remark 0xdead --from alice --dry-run   # fee estimate only
```

### Encoding Calls (for Sudo, XCM, Batch)

`--encode` returns raw call hex without signing — use for wrapping:

```bash
CALL=$(dot --encode chain.tx.AssetRate.create "$ASSET_ID" "$RATE")
dot chain.tx.Sudo.sudo "$CALL" --from alice
```

### Signed Extensions

```bash
dot chain.tx.Balances.transfer_keep_alive <dest> <amount> \
  --from alice --ext '{"tip": "1000000"}'
```

## Runtime APIs

First-class access to runtime APIs — most Substrate CLIs don't expose these:

```bash
dot chain.apis.XcmPaymentApi.query_acceptable_payment_assets 5 --json
dot chain.apis.AssetConversionApi.get_reserves "$TOKEN_A" "$TOKEN_B" --json
dot chain.apis.Core.version --json
```

Call without args to see the method signature.

## Inspect / Explore

```bash
dot chain.inspect     # list all pallets with storage/call/event/error counts
```

## Account Management

```bash
dot account list                                        # includes built-in dev accounts
dot account add treasury <ss58_address>                 # watch-only
dot account import signer --secret "word1 word2 ..."    # from mnemonic
dot account import ci --env SECRET_VAR                  # mnemonic from env var
dot account create new-key                              # generate new
```

Built-in dev accounts: `alice`, `bob`, `charlie`, `dave`, `eve`, `ferdie`

## Other Commands

```bash
dot parachain 1000                                      # derive sovereign accounts
dot parachain 1000 --type sibling --output json
dot sign "hello" --from alice                           # sign a message
dot hash blake2b256 0xdeadbeef                          # hash data
dot ./transfer.yaml --from alice                        # execute from YAML/JSON file
dot tx.System.remark 0xdead --to-yaml                   # encode call → YAML
```

## Key Flags

| Flag | Scope | Purpose |
|------|-------|---------|
| `--json` | all | JSON output (but `undefined` and errors may not be JSON) |
| `--from <name>` | tx | Account to sign with |
| `--encode` | tx | Encode to hex, don't sign or submit |
| `--dry-run` | tx | Estimate fees without submitting |
| `--dump` | query | Dump all entries of a storage map |
| `--ext <json>` | tx | Custom signed extension values |

## Scripting Patterns

For idempotent bash scripting patterns, big number handling, multi-environment config, and XCM composition, see [references/scripting-patterns.md](references/scripting-patterns.md).
