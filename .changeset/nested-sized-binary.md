---
"polkadot-cli": patch
---

Close the remaining gap in the sized `[u8; N]` runtime-API fix from
`1.14.1`: byte arrays **nested inside JSON / YAML struct, enum, or tuple
args** now also pass through as `0x…` hex strings, matching the top-level
positional-arg behaviour.

Previously, only top-level `[u8; N]` args were fixed in `parseTypedArg`. A
call like:

```bash
# File-based command with a nested [u8; 32] field
dot ./authorize.yaml
```

```yaml
chain: polkadot
tx:
  System:
    authorize_upgrade:
      code_hash: "0xabcdef…32bytes"      # nested [u8; 32]
```

…would hit the same `Incompatible runtime entry Tx(System.authorize_upgrade)`
error, because the nested byte array went through `normalizeValue` (the JSON
branch) which still decoded it to `Uint8Array`. That path is now aligned with
the top-level rule.

**Regression suite.** To prevent this class of bug from returning, the test
suite now imports papi's own `@polkadot-api/metadata-compatibility` and
asserts that every representative byte-array typedef parsed by the CLI is
accepted by papi's `isCompatible` guard. Any future drift between our
argument parsing and papi's compatibility check fails tests before release.

Affects any runtime API / tx call / storage key with a `[u8; N]` field — in
particular `System.authorize_upgrade`, `ReviveApi.call`, anything touching
`H160` / `H256` / raw `AccountId32` inside a nested payload.
