---
name: dot-cli
description: >
  Guide for using the `dot` CLI (polkadot-cli) to interact with Polkadot/Substrate chains.
  Use when the user works with Substrate-based blockchains — querying storage, submitting
  transactions, calling runtime APIs, raw JSON-RPC calls, managing chain connections, or
  scripting multi-chain setups. Triggers: user mentions `dot` CLI, polkadot-cli,
  Substrate chain queries, extrinsic submission, runtime APIs, JSON-RPC, `system_health`
  / `chain_getBlock` / `rpc_methods`, XCM, asset pools, or chain setup scripts using `dot`.
---

# dot CLI (polkadot-cli)

Unified CLI for Polkadot/Substrate chains. Install: `npm install -g polkadot-cli@latest`

## Core Pattern

```
dot [chain.]<category>[.Pallet[.Item]] [args] [options]
```

Categories: `query`, `tx`, `apis`, `const`, `events`, `errors`, `extensions`, `rpc`

Top-level commands: `dot inspect`, `dot metadata`, `dot chain`, `dot account`, `dot sign`, `dot hash`.

Omit deeper levels to discover what's available. Always include the chain prefix:

```bash
dot polkadot.query                # list pallets with storage
dot polkadot.query.Balances       # list storage items in Balances
dot polkadot.apis                 # list runtime APIs
dot polkadot.apis.Core            # list methods in an API
```

## Chain Management

Polkadot, Paseo, and all system parachains ship preconfigured. Add custom chains by RPC:

```bash
dot chain add kusama --rpc wss://kusama-rpc.polkadot.io
# Output:
# ✓ Added kusama
# Updating metadata for kusama...
# ✓ kusama
```

List configured chains; the default output is a compact tree with relay/parachain structure only. Pass `-v` to also print RPC endpoints, or use `dot chain info <name>` for full per-chain detail:

```bash
dot chains                        # compact tree of names + parachain IDs
dot chains -v                     # same tree + RPC endpoints inline
dot chain info polkadot           # rpc, parachains, metadata cache status
dot chain polkadot                # bare-noun shortcut for `chain info polkadot`
dot chain info polkadot --json    # structured object; metadata: null when not cached
```

`dot chain <name>` falls through to `chain info` when `<name>` isn't a known action verb (`add`/`remove`/`update`/`list`/`export`/`import`/`info`). Use this to check whether metadata is cached before scripted queries:

```bash
dot chain info polkadot --json | jq -r '.metadata.specVersion // "uncached"'
# Output (after `dot chain update polkadot`):
# 1003000
```

Every chain-consuming command needs an explicit chain — prefer the dotpath prefix:

```bash
# Recommended — chain prefix
dot polkadot.query.System.Number
# Output:
# 31014744

# Equivalent — --chain flag
dot query.System.Number --chain polkadot
# Output:
# 31014744
```

**Critical gotcha:** Don't combine `--chain <name>` with `--rpc <url>` pointing at a different chain. The metadata cache is keyed by chain name, not RPC URL, so the CLI will decode against stale metadata and silently produce wrong results. Register a fresh alias instead:

```bash
# WRONG — polkadot metadata decoded against a Kusama RPC
dot inspect --chain polkadot --rpc wss://kusama-rpc.polkadot.io

# CORRECT — register, then use the prefix
dot chain add my-ah --rpc wss://example.com/asset-hub
dot inspect my-ah
```

## Querying Storage

```bash
# Plain storage value
dot polkadot.query.System.Number
# Output:
# 31014744

# Map lookup — Alice's balance on Polkadot
dot polkadot.query.System.Account 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
# Output:
# {
#   "nonce": 0,
#   "consumers": 0,
#   "providers": 0,
#   "sufficients": 0,
#   "data": { "free": "0", "reserved": "0", "frozen": "0", "flags": "..." }
# }

# Asset metadata — numeric key on Asset Hub
dot polkadot-asset-hub.query.Assets.Metadata 1984
# Output:
# {
#   "deposit": "2008200000",
#   "name": "Tether USD",
#   "symbol": "USDt",
#   "decimals": 6,
#   "is_frozen": false
# }

# Dump all entries of a map
dot paseo-asset-hub.query.AssetConversion.Pools --dump

# JSON output (pipe-safe)
dot polkadot.query.System.Number --json
# Output:
# 31014744
```

Queries always read the latest finalized head — **historical state reads are not supported**. `--at <block>` is a tx-submission flag, not a query flag.

### Handling `undefined` — Critical for Scripting

Queries return the literal string `undefined` (not valid JSON) when a key doesn't exist. Always guard before piping to `jq`:

```bash
ID=999999999  # an asset id we know doesn't exist
RESULT=$(dot polkadot-asset-hub.query.Assets.Asset "$ID")
if [ "$RESULT" == "undefined" ]; then
  echo "not found"
fi
# Output:
# not found
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
# Dry-run a transfer — no broadcast, just estimate fees. The Decode block
# renders the call as indented JSON under the `Pallet.call` header, so even
# deeply nested calls (Sudo, batch, XCM) stay readable.
dot polkadot.tx.Balances.transfer_keep_alive 5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty 1000000000 --from alice --dry-run
# Output:
#   Chain:  polkadot
#   From:   alice (5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY)
#   Call:   0x050300...02286bee
#   Decode: Balances.transfer_keep_alive
#     {
#       "dest": { "type": "Id", "value": "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty" },
#       "value": 1000000000
#     }
#   Estimated fees: 158403157

# Submit (omit --dry-run). Method names are snake_case as defined in the runtime.
dot polkadot.tx.Balances.transfer_keep_alive bob 1000000000 --from alice
```

### Encoding Calls (for Sudo, XCM, Batch)

`--encode` returns raw call hex without signing — use for wrapping:

```bash
# Encode an inner call, then wrap with Sudo
CALL=$(dot paseo-asset-hub.tx.System.remark 0xdeadbeef --encode)
echo "$CALL"
# Output:
# 0x000010deadbeef

dot paseo-asset-hub.tx.Sudo.sudo "$CALL" --from alice --dry-run
# Output:
#   Chain:  paseo-asset-hub
#   From:   alice (5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY)
#   Call:   0xfb00000010deadbeef
#   Decode: Sudo.sudo
#     {
#       "call": { "type": "System", "value": { "type": "remark", "value": { "remark": "0xdeadbeef" } } }
#     }
#   Estimated fees: 7424769
```

### Tipping and Other Transaction Options

Use `--tip` to set a priority tip in plancks. `--nonce`, `--mortality`, and `--at` are also available; see the README's "Transaction options" section.

```bash
dot polkadot.tx.System.remark 0xdead --from alice --tip 1000000 --dry-run
```

For non-standard signed extensions, override with `--ext '{"<Identifier>":{"value":<v>}}'`. List the chain's extensions with `dot <chain>.extensions`.

## Runtime APIs

First-class access to runtime APIs — most Substrate CLIs don't expose these:

```bash
# Runtime version on Polkadot
dot polkadot.apis.Core.version --json
# Output:
# {
#   "spec_name": "polkadot",
#   "impl_name": "parity-polkadot",
#   "spec_version": 2002001,
#   "transaction_version": 26,
#   ...
# }

# Pool reserves on Asset Hub: native (DOT) ↔ USDt (asset id 1984)
dot polkadot-asset-hub.apis.AssetConversionApi.get_reserves \
  '{"parents":1,"interior":{"type":"Here"}}' \
  '{"parents":0,"interior":{"type":"X2","value":[{"type":"PalletInstance","value":50},{"type":"GeneralIndex","value":"1984"}]}}' \
  --json
# Output (live; reserves change with each swap):
# [
#   "801299477230750",
#   "99382392973"
# ]
```

Call a method without args to see its signature, or use `--help`.

## Raw JSON-RPC

Runtime APIs and storage cover everything the runtime exposes; the `rpc` category covers what the **node** exposes outside the runtime — `system_*` (sync state, peers, version), `chain_*` (blocks/headers/finalized head), `state_*` (raw storage, key iteration, runtime version), `author_*` (mempool, key management), `payment_*` (fee estimation), consensus families (`babe_*`, `grandpa_*`, `mmr_*`, `beefy_*`), and the new spec families (`chainSpec_v1_*`, `archive_v1_*`, `rpc_methods`).

Methods are discovered per-chain via the `rpc_methods` JSON-RPC call and cached. Use it when the user asks for things like "is the node synced?", "what block hash is at height N?", "what's in the mempool?", or "fee estimate for this encoded tx?":

```bash
# List the methods this node exposes, grouped by family
dot polkadot.rpc

# Sync / health
dot polkadot.rpc.system_health --json
# Output:
# {
#   "peers": 131,
#   "isSyncing": false,
#   "shouldHavePeers": true
# }

# Block hash by height (returns latest if no arg)
dot polkadot.rpc.chain_getBlockHash 1000
# Output:
# "0xcf36a1e4a16fc579136137b8388f35490f09c5bdd7b9133835eba907a8b76c30"

# Mempool snapshot — list pending extrinsics
dot polkadot.rpc.author_pendingExtrinsics --json | jq length

# Fee estimate for an already-encoded extrinsic
ENCODED=$(dot polkadot.tx.System.remark 0xdead --from alice --encode)
dot polkadot.rpc.payment_queryInfo "$ENCODED" --json

# Curated --help shows the arg signature and a ⚠️ WRITE tag for state-changing methods
dot polkadot.rpc.author_insertKey --help
```

The `rpc` category is **flat** — there's no pallet level. Form: `[chain.]rpc.<method_name>` (underscores stay in the single segment, e.g. `polkadot.rpc.chain_getBlock`).

Subscription methods (`*_subscribe*`, `chainHead_v1_follow`, `transaction_v1_*`) appear in tab-completion but error out as one-shots — they need a follow session. About 50 well-known methods carry curated descriptions and arg names; any other method the node reports is callable via raw passthrough. Use `dot polkadot.rpc --refresh` to re-discover after a node upgrade.

### Complex Arguments (Location, enums)

Enum-shaped args — including XCM `Location` / `VersionedLocation` and most pallet enums — are passed as JSON with `{type, value}` shape. `type` names the variant; `value` is the inner data (may be another `{type, value}`, an array, or a primitive). See [references/scripting-patterns.md](references/scripting-patterns.md) for the bash-quoting pattern when interpolating variables into Location JSON.

Tips for discovering the exact shape a runtime expects:

- Run `--dump` on a related storage map that uses the same type and read back an existing entry.
- `dot inspect <chain>.<Pallet>.<Item>` prints the full type for a storage item.

## Full Metadata Dump

`dot metadata <chain>` prints the chain's runtime metadata as one structured JSON blob — pallets (with calls, events, errors, storage, constants), runtime APIs, transaction extensions, and a runtime fingerprint header. Use this when you (or an agent) want a single source of truth for what's available on a chain instead of walking `dot inspect` piecemeal.

`metadata` is a top-level command — there is no chain-prefix form. Pass the chain name as a positional argument.

```bash
# Slice with jq — list all Balances call names
dot metadata polkadot | jq -r '.pallets[] | select(.name=="Balances") | .calls[].name'
# Output:
# burn
# force_adjust_total_issuance
# force_set_balance
# ...
# transfer_keep_alive
# upgrade_accounts

# Other useful flags
dot metadata polkadot --raw      # SCALE-encoded bytes as 0x… hex
dot metadata polkadot --cached   # use cached metadata, no network round-trip
```

The default fetch always hits the chain and updates the local fingerprint sidecar. Pair with `--raw` if you want the canonical SCALE bytes; the JSON form is decoded and includes docs.

## Inspect / Explore

`inspect` is a top-level command, **not** a dotpath category. `dot <chain>.inspect...` does not parse. The recommended form puts the chain on the *target*:

Output is **width-aware**: short signatures stay on one line, long ones expand across multiple lines with field names aligned by colon. Composite values are color-coded when stdout is a TTY; piped output stays plain.

```bash
# Pallet detail — list storage, constants, calls, events, errors
dot inspect polkadot.System
# Output:
# System Pallet
#
#   Storage Items:
#     Account [map]
#       Key:   AccountId32
#       Value: {
#         nonce      : u32,
#         consumers  : u32,
#         providers  : u32,
#         sufficients: u32,
#         data       : { free: u128, reserved: u128, frozen: u128, flags: u128 },
#       }
#         The full account information for a particular account ID.
#     ...

# Storage item detail — Type/Key/Value on separate lines, composite values expand
dot inspect polkadot.System.Account
# Output:
# System.Account (Storage)
#
#   Type:  map
#   Key:   AccountId32
#   Value: {
#     nonce      : u32,
#     consumers  : u32,
#     providers  : u32,
#     sufficients: u32,
#     data       : { free: u128, reserved: u128, frozen: u128, flags: u128 },
#   }
#
#   The full account information for a particular account ID.

# Long call signatures expand across lines
dot inspect polkadot.Referenda.submit
# Output:
# Referenda.submit (Call)
#
#   Args: (
#     proposal_origin : system | Origins | ParachainsOrigin | XcmPallet,
#     proposal        : Legacy | Inline | Lookup,
#     enactment_moment: At | After,
#   )
#   ...

# To list all pallets on a chain, use --chain (a single positional is read as a pallet name)
dot inspect --chain polkadot
```

A single positional arg is always treated as a pallet name, so `dot inspect polkadot` does **not** list pallets on the `polkadot` chain — use `--chain polkadot` for that.

Enum-variant visibility: enums up to **24 variants** now show variant names inline (e.g. `system | Origins | ParachainsOrigin | XcmPallet`). Only enums with more than 24 variants collapse to `enum(N variants)`. When that summary appears, drill into a storage item that uses the same type with `dot inspect <Pallet>.<Item> --chain <name>` (it'll expand the inner type), or `--dump` a real entry to read back the shape.

## Account Management

```bash
# List dev + stored accounts. Stored accounts are bucketed by kind
# (Signers / Watch-only / Pallet Sovereigns / Parachain Sovereigns); empty
# sections are omitted. Each account: first line is `name  ss58` (clean
# columns for copy-paste). Extra attributes (path, env, pallet-id,
# parachain, parachain-type) render on tree-style continuation lines —
# the labels mirror the `--flag` that sets each value.
dot account list
# Output:
# Dev Accounts
#
#   Alice    5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
#   Bob      5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty
#   ...
#
# Signers
#
#   ci-signer    5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy
#      ├─ path: //ci
#      └─ env:  $CI_SECRET
#
# Pallet Sovereigns
#
#   Treasury     5EYCAe5ijiYfyeZ2JJCGq56LmPyNRAKzpG4QkoQkkQNB5e6Z
#      └─ pallet-id: py/trsry (0x70792f7472737279)
#
# Parachain Sovereigns
#
#   People       5Ec4AhPaYcfBz8fMoPd4EfnAgwbzRS7np3APZUnnFo12qEYk
#      ├─ parachain:      1004
#      └─ parachain-type: child

# Watch-only — no secret, just a named address
dot account add treasury 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY

# Keyed account from a BIP39 mnemonic (use --secret, or --env to keep it off disk)
dot account add signer --secret "word1 word2 ... word12"
dot account add ci --env SECRET_VAR

# Generate a new account
dot account create new-key
# Output:
# Account Created
#
#   Name:          new-key
#   Address:       5HQPcHZ2gUKdJM3JbgFvY8t5PfdkpooH2u2LQrAHZ61dZ57M
#   Mnemonic:      defy ginger general follow use try ...
#
#   Save this mnemonic phrase! It is the only way to recover this account.
```

Built-in dev accounts: `alice`, `bob`, `charlie`, `dave`, `eve`, `ferdie`

### Sovereign Accounts (Parachain & Pallet)

`dot account add` accepts derivation flags that compute a deterministic 32-byte address and store it as a named watch-only account — reusable in `--from`, as tx args, and in `dot account list`. Offline; no chain connection required.

```bash
# Pallet sovereign — Treasury (PalletId b"py/trsry")
dot account add Treasury --pallet-id py/trsry
# Output:
# Account Added (watch-only)
#
#   Name:    Treasury
#   Address: 5EYCAe5ijiYfyeZ2JJCGq56LmPyNRAKzpG4QkoQkkQNB5e6Z
#   Source:  pallet py/trsry (0x70792f7472737279)

# Pallet sovereign — hex PalletId form
dot account add Bounties --pallet-id 0x70792f626f756e74

# Parachain sovereign — `--parachain-type` is REQUIRED (no default)
dot account add People --parachain 1004 --parachain-type child
dot account add People-Sibling --parachain 1004 --parachain-type sibling

# JSON output records the derivation
dot account add Bnt --pallet-id py/bount --json
# {
#   "name": "Bnt",
#   "address": "5EYCAe5ijiYdYTM8d3VytEARdH7dFp4rdCPpAsPXrfopdm7d",
#   "watchOnly": true,
#   "derivation": { "kind": "pallet", "palletId": "py/bount",
#                   "palletIdHex": "0x70792f626f756e74" }
# }
```

**How it derives:**

- **Pallet:** 32-byte AccountId is `b"modl"` (4 bytes) + `palletId` (8 bytes) + 20 zero bytes. PalletId comes from each pallet's `#[pallet::constant] type PalletId` (read with `dot <chain>.const.<Pallet>.PalletId`).
- **Parachain:** 32-byte AccountId is `b"para"` (child) or `b"sibl"` (sibling) + paraId as LE u32 (4 bytes) + 24 zero bytes.

**Discovering a chain's PalletId from metadata:**

```bash
# Pre-req: metadata cached (dot chain update polkadot).
# Output is JSON-quoted hex — strip quotes with tr.
dot account add Treasury --pallet-id "$(dot polkadot.const.Treasury.PalletId | tr -d '"')"
```

**Stateless derivation for scripts (no save):** the same `--pallet-id` /
`--parachain` / `--parachain-type` flags work on `dot account inspect` to
compute and print the address **without** writing to accounts.json. Use this
when you just need the SS58 in a script — no name to invent, no cleanup later.

```bash
# Pretty output
dot account inspect --pallet-id py/trsry --prefix 0
# Account Info
#
#   Kind:        pallet sovereign
#   Public Key:  0x6d6f646c70792f74727372790000000000000000000000000000000000000000
#   SS58:        13UVJyLnbVp9RBZYFwFGyDvVd1y27Tt8tkntv6Q7JVPhFsTB
#   Source:      PalletId py/trsry (0x70792f7472737279)
#   Prefix:      0

# Just the SS58 (script-friendly)
SS58=$(dot account inspect --pallet-id py/trsry --prefix 0 --json | jq -r .ss58)

# Parachain sovereign
dot account inspect --parachain 1004 --parachain-type child --json | jq -r .ss58
```

Use `account add` to persist (named, reusable in `--from`/tx args, appears in
`dot account list`); use `account inspect` to derive ad-hoc.

**Constraints (will error):** `--parachain` requires `--parachain-type child|sibling`; `--parachain` and `--pallet-id` are mutually exclusive; on `account add`, derivation flags can't combine with a positional address or with `--secret` / `--env`; on `account inspect`, derivation flags can't combine with a positional input.

**Deprecated alias:** the legacy `dot parachain <paraId>` command is preserved for backward compat with older scripts. Stdout is byte-identical to prior releases; a deprecation warning is printed to stderr. Prefer `dot account inspect --parachain <id> --parachain-type <type>` for new code (tracked for removal in [#208](https://github.com/peetzweg/polkadot-cli/issues/208)):

```bash
# Old (deprecated, still works)
dot parachain 1000 --type child --json
# New
dot account inspect --parachain 1000 --parachain-type child --json
```

## Other Commands

```bash
# Sign arbitrary bytes with an account keypair (output is a MultiSignature value)
dot sign "hello world" --from alice
# Output:
#   Type:       Sr25519
#   Message:    0x68656c6c6f20776f726c64
#   Signature:  0x4283a3bbae463c39264ca193b1bcce61702794e54e482bc2e46202c85ef6a544...
#   Enum:       Sr25519(0x4283a3bbae463c39264ca193b1bcce61702794e54e482bc2e46202c8...)

# Compute a hash
dot hash blake2b256 0xdeadbeef
# Output:
# 0xf3e925002fed7cc0ded46842569eb5c90c910c091d8d04a1bdf96e0db719fd91

# Execute from a YAML/JSON file
dot ./transfer.yaml --from alice

# Encode a call to YAML (compatible with file-based input)
dot polkadot.tx.System.remark 0xdeadbeef --to-yaml
# Output:
# chain: polkadot
# tx:
#   System:
#     remark:
#       remark: "0xdeadbeef"
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
- **`Unknown account or address "X"`** / account has no public key resolved yet — the `--from` name isn't registered. Check `dot account list`, or add it with `dot account add <name> --secret "..."` / `dot account add <name> --env VAR`.
- **`undefined` piped into `jq`** — the literal string `undefined` is not JSON. Guard with `[ "$X" == "undefined" ]` before piping.
- **Decode errors after a runtime upgrade** — metadata cache is keyed by chain name; register a fresh `dot chain add` alias for the upgraded chain rather than reusing the old one.
- **Wasm trap / "validate_transaction" panic on submit** — almost always stale local metadata. The CLI now prints a `⚠ Local metadata for "<chain>" is out of date … Run: dot chain update <chain>` line right after such errors. Run that command and retry. The check uses both `specVersion` and the runtime code hash, so it also catches local-node restarts where the wasm changed but `specVersion` was kept the same. Set `DOT_TRUST_CACHED_METADATA=1` to suppress the check entirely.

## Scripting Patterns

Highlights from [references/scripting-patterns.md](references/scripting-patterns.md):

- `undefined`-guarded check-then-act for idempotent scripts.
- XCM `Location` JSON shape and the bash escaping gotcha (`'"$VAR"'` breaks out of single-quoted JSON to interpolate).
- FixedU128 rate math and u128 arithmetic via `python3` when bash overflows past 2^63.

See the full reference for multi-environment config loaders and batch/sudo composition patterns.
