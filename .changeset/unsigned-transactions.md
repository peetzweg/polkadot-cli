---
"polkadot-cli": minor
---

Add `--unsigned` flag for submitting unsigned/authorized transactions (v5 general transactions).

**New: `--unsigned` flag on `dot tx`**

Submit transactions without a signer. Used for governance-authorized calls like `People.create_people_collection` on the People chain, where authorization comes from on-chain mechanisms (e.g. `AuthorizeCall` extension) rather than cryptographic signatures.

```bash
# Submit an authorized transaction on the People chain
dot tx People.create_people_collection --unsigned --chain people

# Dry-run to inspect before submitting
dot tx People.create_people_collection --unsigned --chain people --dry-run

# Encode the full general transaction bytes
dot tx People.create_people_collection --unsigned --chain people --encode

# JSON output for scripting
dot tx People.create_people_collection --unsigned --chain people --json
```

**How it works**

The CLI constructs a v5 general transaction (`0x45` format) with all signed extension "extra" values auto-defaulted:
- `VerifySignature` → `Disabled`
- `Option<T>` extensions → `None`
- `void` extensions → empty
- `CheckMortality` → `Immortal`
- `CheckNonce` → `0`
- `ChargeAssetTxPayment` → zero tip, no asset

User overrides via `--ext` are supported for chains with non-standard extension requirements.

**File-based input**

YAML/JSON files now support an `unsigned: true` field:

```yaml
chain: people
unsigned: true
tx:
  People:
    create_people_collection: null
```

**Mutually exclusive flags**

`--unsigned` cannot be combined with `--from`, `--nonce`, `--tip`, or `--mortality`.
