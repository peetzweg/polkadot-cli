# dot CLI — Bash Scripting Patterns

## Table of Contents

- [Idempotent Check-Then-Act](#idempotent-check-then-act)
- [Multi-Environment Config](#multi-environment-config)
- [XCM Locations (JSON Arguments)](#xcm-locations-json-arguments)
- [Encoding Calls for Sudo](#encoding-calls-for-sudo)
- [Big Number Arithmetic](#big-number-arithmetic)
- [FixedU128 Rate Calculation](#fixedu128-rate-calculation)
- [Checking Runtime Capabilities](#checking-runtime-capabilities)
- [Common Gotchas](#common-gotchas)

---

## Idempotent Check-Then-Act

Query on-chain state before acting. The `undefined` check is the core pattern:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Check if asset exists
ASSET=$(dot my-chain.query.Assets.Asset "$ASSET_ID")
if [ "$ASSET" == "undefined" ]; then
  echo "Asset not found, creating"
  CALL=$(dot --encode my-chain.tx.Assets.force_create "$ASSET_ID" "$OWNER" true 10)
  dot my-chain.tx.Sudo.sudo "$CALL" --from "$SIGNER"
else
  echo "Asset already exists"
fi
```

For values that need comparison (not just existence), strip quotes:

```bash
CURRENT_RATE=$(dot chain.query.AssetRate.ConversionRateToNative "$ASSET_ID" | tr -d '"')
if [ "$CURRENT_RATE" == "undefined" ]; then
  # create
elif [ "$CURRENT_RATE" != "$EXPECTED_RATE" ]; then
  # update
else
  echo "Already correct"
fi
```

## Multi-Environment Config

Pattern: base config + environment-specific overrides loaded by a shared loader.

```bash
# config-base.env
PARACHAIN_ID_ASSET_HUB=1000
PUSD_DECIMALS=6
NATIVE_TOKEN='{"parents":1,"interior":{"type":"Here"}}'

# config-preview.env
RPC_PEOPLE=wss://previewnet.substrate.dev/people
NATIVE_DECIMALS=12
PUSD_ASSET_ID=3
SIGNER_SUDO="alice"

# config-next.env
RPC_PEOPLE=wss://paseo-people-next-rpc.polkadot.io
NATIVE_DECIMALS=10
PUSD_ASSET_ID=50000413
SIGNER_SUDO="people-paseo-sudo"
```

Loader registers chain aliases so scripts use generic names:

```bash
# load-config.sh
source config-base.env
source "config-${ENV}.env"
dot chain add people --rpc "$RPC_PEOPLE" 2>/dev/null || true
```

Scripts then use `dot people.query...` regardless of environment.

## XCM Locations (JSON Arguments)

Many pallets use XCM `Location` types as keys. These are JSON objects:

```bash
# Native token (relay chain asset, from parachain perspective)
NATIVE='{"parents":1,"interior":{"type":"Here"}}'

# Local asset on Asset Hub (PalletInstance 50 = Assets pallet)
LOCAL_ASSET='{"parents":0,"interior":{"type":"X2","value":[{"type":"PalletInstance","value":50},{"type":"GeneralIndex","value":"'"$ASSET_ID"'"}]}}'

# Foreign asset on People chain (points to Asset Hub's asset)
FOREIGN_ASSET='{"parents":1,"interior":{"type":"X3","value":[{"type":"Parachain","value":1000},{"type":"PalletInstance","value":50},{"type":"GeneralIndex","value":"'"$ASSET_ID"'"}]}}'
```

Note the bash string escaping: `'"$VAR"'` breaks out of single-quote JSON to interpolate the variable.

## Encoding Calls for Sudo

Privileged calls (force_create, AssetRate.create, etc.) need root origin. Wrap in Sudo:

```bash
INNER_CALL=$(dot --encode chain.tx.AssetRate.create "$ASSET_ID" "$RATE")
dot chain.tx.Sudo.sudo "$INNER_CALL" --from "$SIGNER_SUDO"
```

For batch operations:

```bash
CALL_A=$(dot --encode chain.tx.Assets.force_create ...)
CALL_B=$(dot --encode chain.tx.Assets.set_metadata ...)
dot chain.tx.Utility.batch_all "[$CALL_A, $CALL_B]" --from "$SIGNER"
```

## Big Number Arithmetic

Substrate uses u128 for balances. Bash handles up to 2^63 (~9.2 * 10^18). For amounts within this range, bash arithmetic works:

```bash
# 1000 tokens with 12 decimals = 10^15 (fits in bash)
amount=$(( 1000 * 10**$NATIVE_DECIMALS ))
```

For values exceeding 10^18 (e.g., FixedU128 rates, total supplies), use python3:

```bash
BIG_VALUE=$(python3 -c "print(10**18 * 10**$NATIVE_DECIMALS // (4 * 10**$PUSD_DECIMALS))")
```

## FixedU128 Rate Calculation

`AssetRate.ConversionRateToNative` stores a `FixedU128` with 18 fractional digits. The stored integer represents `rate * 10^18`.

For a conversion rate of "1 token_A = R token_native" in smallest units:

```
stored_value = (smallest_unit_of_asset_in_native) * 10^18
```

Example — pUSD to DOT at 1:4 (1 DOT = 4 pUSD, so 1 pUSD = 0.25 DOT):

```bash
# Formula: rate = 10^18 * 10^NATIVE_DEC / (RATIO * 10^PUSD_DEC)
# where RATIO = 4 (how many pUSD per 1 native)
RATE=$(python3 -c "print(10**18 * 10**$NATIVE_DECIMALS // (4 * 10**$PUSD_DECIMALS))")

# preview (native=12, pusd=6):  250000000000000000000000  (2.5 * 10^23)
# next    (native=10, pusd=18): 2500000000               (2.5 * 10^9)
```

## Checking Runtime Capabilities

### List pallets

```bash
dot chain.query --json | python3 -c "
import sys, json
for p in json.load(sys.stdin)['pallets']:
    print(p['name'])
"
```

### Check if a pallet exists

```bash
dot chain.query --json | python3 -c "
import sys, json
pallets = [p['name'] for p in json.load(sys.stdin)['pallets']]
print('AssetConversion' in pallets)
"
```

### List runtime APIs

```bash
dot chain.apis --json | python3 -c "
import sys, json
for a in json.load(sys.stdin)['apis']:
    print(a['name'])
"
```

### Check which assets are accepted for fee payment

```bash
dot chain.apis.XcmPaymentApi.query_acceptable_payment_assets 5 --json
```

This is a runtime API — the accepted assets are derived by the runtime (e.g., from existing AMM pools on Asset Hub), not set manually.

### Check pool reserves

```bash
dot chain.apis.AssetConversionApi.get_reserves "$NATIVE" "$ASSET" --json
# Returns: [native_reserve, asset_reserve] or null/undefined if no pool
```

## Common Gotchas

1. **`undefined` is not JSON.** Always check before piping to `jq`.

2. **`--rpc` uses wrong metadata.** Always register chains with `dot chain add`, never rely on `--rpc` alone. Metadata cache is keyed by chain name, not RPC URL, so `--rpc` can pick up stale metadata from a previous chain with the same alias.

3. **Every command needs an explicit chain.** No default chain — use a `<chain>.` dotpath prefix (`dot polkadot.query.System.Number`) or `--chain <name>`. Commands without either error out. Note `inspect` is a top-level command; only `--chain` works for it.

4. **u128 returned as quoted strings.** `"1000000000000"` not `1000000000000`. Strip quotes for comparison: `tr -d '"'`

5. **`--json` doesn't guarantee JSON.** Errors and `undefined` are not valid JSON even with `--json`.

6. **`--dump` required for keyless map queries.** `dot query.Map` without a key or `--dump` shows usage help, not results.
