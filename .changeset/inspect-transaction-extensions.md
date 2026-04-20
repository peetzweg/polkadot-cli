---
"polkadot-cli": minor
---

Add `dot extensions` to inspect a chain's transaction (signed) extensions.

**New: `extensions` category**

Users can now discover which transaction extensions a chain exposes, which ones
polkadot-api fills in automatically, and which ones must be provided via
`--ext` when building a transaction. This closes issue #169.

```bash
# List every transaction extension on a chain
dot extensions --chain polkadot

# Detail view for a single extension — shows value type, additionalSigned type,
# and a usage hint for non-builtin extensions
dot extensions.CheckMortality --chain polkadot

# Chain-prefix form
dot polkadot.extensions.ChargeTransactionPayment

# Structured output for scripts and agents
dot extensions --chain polkadot --json
```

Aliases: `extension`, `ext`. Typos produce suggestion-style errors. Shell
completion proposes identifiers after `dot extensions.`.

Each entry is tagged `[builtin]` (handled internally by polkadot-api) or
`[custom]` (requires `--ext '{"<Identifier>":{"value":...}}'` when signing).
