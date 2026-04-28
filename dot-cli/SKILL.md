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

Categories: `query`, `tx`, `apis`, `const`, `events`, `errors`, `extensions`

Top-level commands: `dot inspect`, `dot metadata`, `dot chain`, `dot account`, `dot parachain`, `dot sign`, `dot hash`.

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
```

Once registered, every command needs an explicit chain — either a `<chain>.` dotpath prefix or `--chain <name>`. There is no default chain.

```bash
dot my-chain.query.System.Number       # dotpath prefix
dot query.System.Number --chain my-chain  # --chain flag
```

**Critical gotcha:** Don't combine `--chain <name>` with `--rpc <url>` pointing at a different chain. The metadata cache is keyed by chain name, not RPC URL, so the CLI will decode against stale metadata and silently produce wrong results. Register a fresh alias instead:

```bash
# WRONG — polkadot metadata decoded against a Kusama RPC
dot inspect --chain polkadot --rpc wss://kusama-rpc.polkadot.io

# CORRECT
dot chain add my-ah --rpc wss://example.com/asset-hub
dot inspect --chain my-ah
```

## Querying Storage

```bash
dot chain.query.System.Number                              # plain value
dot chain.query.System.Account <address>                   # map lookup
dot chain.query.AssetConversion.Pools --dump               # all map entries
dot chain.query.Assets.Metadata '{"parents":1,...}'        # complex key (JSON)
dot chain.query.System.Number --json                       # JSON output
```

Queries always read the latest finalized head — **historical state reads are not supported**. `--at <block>` is a tx-submission flag, not a query flag.

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

### Complex Arguments (Location, enums)

Enum-shaped args — including XCM `Location` / `VersionedLocation` and most pallet enums — are passed as JSON with `{type, value}` shape. `type` names the variant; `value` is the inner data (may be another `{type, value}`, an array, or a primitive):

```bash
# Location for a local asset on Asset Hub (PalletInstance 50 = Assets, GeneralIndex = asset id)
LOC_A='{"parents":1,"interior":{"type":"Here"}}'
LOC_B='{"parents":0,"interior":{"type":"X2","value":[{"type":"PalletInstance","value":50},{"type":"GeneralIndex","value":"1984"}]}}'
dot polkadot-asset-hub.apis.AssetConversionApi.get_reserves "$LOC_A" "$LOC_B" --json
```

Tips for discovering the exact shape a runtime expects:

- Run `--dump` on a related storage map that uses the same type and read back an existing entry.
- `dot inspect <Pallet>.<Item> --chain <name>` prints the full type for a storage item.

See [references/scripting-patterns.md](references/scripting-patterns.md) for more Location examples and the bash string-escaping pattern (`'"$VAR"'`).

## Full Metadata Dump

`dot metadata <chain>` prints the chain's runtime metadata as one structured JSON blob — pallets (with calls, events, errors, storage, constants), runtime APIs, transaction extensions, and a runtime fingerprint header. Use this when you (or an agent) want a single source of truth for what's available on a chain instead of walking `dot inspect` piecemeal.

```bash
# Decoded JSON — fetches fresh from the chain (also refreshes the local cache)
dot metadata polkadot

# SCALE-encoded metadata bytes as a single 0x… hex line (for re-decoding tools)
dot metadata polkadot --raw

# Use cached metadata only — no network round-trip (offline / CI)
dot metadata polkadot --cached

# Slice with jq
dot metadata polkadot | jq '.pallets[] | select(.name=="Balances") | .calls[].name'
dot metadata polkadot | jq '.transactionExtensions[].identifier'
dot metadata polkadot | jq '.runtime'   # specVersion, transactionVersion, codeHash, …
```

The default fetch always hits the chain and updates the local fingerprint sidecar. Pair with `--raw` if you want the canonical SCALE bytes; the JSON form is decoded and includes docs.

## Inspect / Explore

`inspect` is a top-level command, **not** a dotpath category. `dot <chain>.inspect...` does not parse. Two valid forms:

```bash
# --chain flag with an optional positional target
dot inspect --chain polkadot                      # list all pallets (with storage/call/event/error counts)
dot inspect System --chain polkadot               # list items in one pallet
dot inspect System.Account --chain polkadot       # show one storage item's type

# Chain prefix on the inspect target (two or three dot-separated segments, chain first)
dot inspect polkadot.System
dot inspect polkadot.System.Account
```

A single positional arg is always treated as a pallet name, so `dot inspect polkadot` does **not** list pallets on the `polkadot` chain — use `--chain polkadot` for that.

Useful for discovering enum variants: when a method signature shows `enum(N variants)`, run `dot inspect <Pallet>.<Item> --chain <name>` on a storage item that uses the same type, or `--dump` a storage map and read back the shape from a real entry.

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
| `--at <block>` | tx | Submit at a specific block hash (32-byte `0x…`); defaults to finalized. Not supported on queries. |

## Common Errors

- **`Incompatible runtime entry RuntimeCall(...)`** — usually a runtime API arg shape mismatch: wrong enum `{type, value}`, or a sized-binary `[u8; N]` passed as something other than `0x`-hex. Re-check the signature by calling `dot <chain>.apis.<Api>.<method>` with no args.
- **`Unknown account or address "X"`** / account has no public key resolved yet — the `--from` name isn't registered. Check `dot account list`, or import with `dot account import <name> ...`.
- **`undefined` piped into `jq`** — the literal string `undefined` is not JSON. Guard with `[ "$X" == "undefined" ]` before piping.
- **Decode errors after a runtime upgrade** — metadata cache is keyed by chain name; register a fresh `dot chain add` alias for the upgraded chain rather than reusing the old one.
- **Wasm trap / "validate_transaction" panic on submit** — almost always stale local metadata. The CLI now prints a `⚠ Local metadata for "<chain>" is out of date … Run: dot chain update <chain>` line right after such errors. Run that command and retry. The check uses both `specVersion` and the runtime code hash, so it also catches local-node restarts where the wasm changed but `specVersion` was kept the same. Set `DOT_TRUST_CACHED_METADATA=1` to suppress the check entirely.

## Scripting Patterns

Highlights from [references/scripting-patterns.md](references/scripting-patterns.md):

- `undefined`-guarded check-then-act for idempotent scripts.
- XCM `Location` JSON shape and the bash escaping gotcha (`'"$VAR"'` breaks out of single-quoted JSON to interpolate).
- FixedU128 rate math and u128 arithmetic via `python3` when bash overflows past 2^63.

See the full reference for multi-environment config loaders and batch/sudo composition patterns.
