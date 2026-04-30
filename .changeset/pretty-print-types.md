---
"polkadot-cli": minor
---

Width-aware multi-line pretty-printing for type signatures, call arguments, and decoded calls.

`dot inspect`, the focused listings (`dot <chain>.tx.<Pallet>`, `.query.<Pallet>`, `.events.<Pallet>`, `.extensions`), and `--dry-run` output now render structured types across multiple lines when they don't fit, with syntactic ANSI coloring (field names cyan, primitives yellow, container keywords magenta, enum variants green). Short signatures stay compact.

**Before**

```
  Args: (proposal_origin: system | Origins | ParachainsOrigin | XcmPallet, proposal: Legacy | Inline | Lookup, enactment_moment: At | After)
```

**After**

```
  Args: (
    proposal_origin : system | Origins | ParachainsOrigin | XcmPallet,
    proposal        : Legacy | Inline | Lookup,
    enactment_moment: At | After,
  )
```

**Storage detail** now shows `Type:`, `Key:`, and `Value:` on separate lines (no `→` arrow), with composite values expanded:

```
Assets.Metadata (Storage)

  Type:  map
  Key:   u32
  Value: {
    deposit  : u128,
    name     : Vec<u8>,
    symbol   : Vec<u8>,
    decimals : u8,
    is_frozen: bool,
  }
```

**Dry-run `Decode:`** is now JSON-styled, suitable for very complex calls:

```
  Decode: System.remark
    {
      "remark": "0x68656c6c6f20776f726c64"
    }
```

**Enum variant visibility** — the `enum(N variants)` summary threshold was raised from 4 to 24, so most enums (e.g. `Option<AsPersonalAliasWithAccount | AsPersonalAliasWithProof | ...>`) now show variant names instead of being collapsed.

**Width detection** uses `process.stdout.columns` (falls back to 80). Output is automatically uncolored when stdout isn't a TTY, so piped `--json` and shell-redirected output stay clean.

JSON output (`--json`) is unchanged — type strings continue to be emitted as compact single-line values for scripting.
