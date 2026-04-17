---
"polkadot-cli": minor
---

Remove the default chain feature. Every command that targets a chain must now specify one explicitly — either via the `--chain <name>` flag or a dotpath chain prefix (e.g. `dot polkadot.query.System.Number`). When neither is provided, the CLI fails with a clear error listing the available chains instead of silently falling back to a saved default.

**Why:** the implicit fallback made commands non-transparent — especially in scripts or when switching contexts, users could not tell which chain was actually being hit (see #158).

**Breaking changes:**

- `dot chain default <name>` subcommand removed.
- `dot chain update` now requires a chain name or `--all`; it no longer implicitly targets a default chain.
- `dot chain list` no longer prints a `(default)` marker, and `dot chain list --json` no longer includes a `default` field per chain.
- The `--chain` global-option help text changed from "Target chain (default from config)" to "Target chain (required)".

**Config migration:** any pre-existing `defaultChain` field in `~/.polkadot/config.json` is silently ignored on read and dropped on the next save — no manual migration needed.

**Before:**

```bash
dot chain default kusama
dot query.System.Number     # implicitly targeted kusama
```

**After:**

```bash
dot query.System.Number --chain kusama
# or, equivalently:
dot kusama.query.System.Number
```
