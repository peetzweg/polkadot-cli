---
"polkadot-cli": minor
---

Add derivation flags to `dot account add` that store sovereign addresses as named watch-only accounts. One command lets you turn a parachain ID or a pallet `PalletId` into a stored account that's reusable in `--from`, in tx args, and in `dot account list`.

```bash
# Pallet sovereign (Treasury / Bounties / Crowdloan / NominationPools / …)
dot account add Treasury --pallet-id py/trsry
dot account add Bounties --pallet-id 0x70792f626f756e74

# Parachain sovereign — type is required (child = address on the relay,
# sibling = address from another parachain's POV)
dot account add People --parachain 1004 --parachain-type child
dot account add People-Sibling --parachain 1004 --parachain-type sibling
```

**Derivation** (matches Substrate's `AccountIdConversion::into_account_truncating`):

- Pallet: `b"modl"` (4 bytes) + `palletId` (8 bytes) + 20 zero bytes
- Parachain: `b"para"` (child) or `b"sibl"` (sibling) + paraId LE u32 (4 bytes) + 24 zero bytes

PalletId input is either 8 ASCII chars (`py/trsry`) or 0x-prefixed hex with exactly 16 hex chars (`0x70792f7472737279`). Per-chain PalletIds can be discovered via the existing `const` category:

```bash
dot account add Treasury --pallet-id "$(dot polkadot.const.Treasury.PalletId | tr -d '"')"
```

**Constraints:** `--parachain` requires `--parachain-type child|sibling` (no implicit default); `--parachain` and `--pallet-id` are mutually exclusive; derivation flags cannot be combined with a positional address or with `--secret`/`--env`.

JSON output (`--json`) includes a `derivation` object describing the source — `{ "kind": "pallet", "palletId": "py/trsry", "palletIdHex": "0x..." }` or `{ "kind": "parachain", "paraId": 1004, "type": "child" }` — for round-trippable record-keeping.

**`dot account list` is restructured** to make kinds obvious and SS58s easier to copy-paste. Stored accounts are now bucketed into **Signers**, **Watch-only**, **Pallet Sovereigns**, and **Parachain Sovereigns** sections (empty sections omitted). The first line of each entry is just `name  ss58`; extra attributes render on tree-style continuation lines (`├─` / `└─`, mirroring `dot chains`). Attribute labels are aligned with the `--flag` that sets each value (`path:`, `env:`, `pallet-id:`, `parachain:`, `parachain-type:`) so the listing reads back as a recipe. Multiple attributes per account (e.g. `--path` + `--env`) each get their own branch:

```
Signers
  ci-signer  5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy
     ├─ path: //ci
     └─ env:  $CI_SECRET

Pallet Sovereigns
  Treasury   5EYCAe5ijiYfyeZ2JJCGq56LmPyNRAKzpG4QkoQkkQNB5e6Z
     └─ pallet-id: py/trsry (0x70792f7472737279)

Parachain Sovereigns
  People     5Ec4AhPaYcfBz8fMoPd4EfnAgwbzRS7np3APZUnnFo12qEYk
     ├─ parachain:      1004
     └─ parachain-type: child
```

`--json` adds a `kind` discriminator on every entry plus a `source` object on derived sovereigns.

**`dot account inspect` now surfaces the derivation source.** The output gains a `Kind:` line (`dev` / `signer` / `watch-only` / `pallet sovereign` / `parachain sovereign (child|sibling)`) and, for derived sovereigns, a `Source:` line (`PalletId py/trsry (0x70792f7472737279)` or `parachain 1004`). For env-backed signers there's an `Env:` line; derived child keys show their `Derivation:` path.

**Storage-format change:** `StoredAccount` gains an optional `source` field that records how a watch-only account was derived. Existing accounts without this field continue to work — they're classified as plain `signer` or `watch-only` based on the presence of a secret.

**`dot account inspect` accepts the same derivation flags for stateless lookup.** When you just need the SS58 in a script and don't want a stored entry, run `dot account inspect --pallet-id <id>` or `dot account inspect --parachain <id> --parachain-type <child|sibling>` — same output shape (Kind / Source / SS58 / public key, plus a structured `source` object on `--json`), no name, nothing written to `~/.polkadot/accounts.json`.

```bash
SS58=$(dot account inspect --pallet-id py/trsry --prefix 0 --json | jq -r .ss58)
```

Use `account add` to persist (named, reusable as `--from` / tx arg / in `account list`); use `account inspect` to derive ad-hoc.
