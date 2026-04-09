---
"polkadot-cli": minor
---

Add global `--json` flag for structured JSON output on every command. This is the single highest-impact change for agent and scripting usability.

**New: `--json` flag**

Every command now supports `--json` to output machine-readable JSON instead of colored human-readable text. This works as a shorthand for `--output json` (which continues to work).

```bash
dot inspect --json                          # List pallets as JSON
dot inspect Balances --json                 # Pallet detail as JSON
dot chain list --json                       # Configured chains as JSON
dot account list --json                     # All accounts as JSON
dot account create my-key --json            # New account details as JSON
dot tx.System.remark 0xdead --encode --json # Encoded call as JSON
dot query.System --json                     # Storage items as JSON
dot events.Balances --json                  # Events listing as JSON
dot errors.Balances --json                  # Errors listing as JSON
dot const.System --json                     # Constants listing as JSON
```

For transaction submission, `--json` emits NDJSON (one JSON object per lifecycle event):

```bash
dot tx.System.remark 0xdead --from alice --json
# {"event":"signed","txHash":"0x..."}
# {"event":"broadcasted","txHash":"0x..."}
# {"event":"finalized","blockNumber":123,...}
```

**Breaking: renamed tx decode flags**

The `--json` and `--yaml` flags on the `tx` command (used to decode a raw call hex into a re-importable file format) have been renamed to `--to-json` and `--to-yaml` to avoid conflict with the new global `--json` flag.

```bash
# Before
dot tx 0x1f00... --yaml
dot tx.System.remark 0xdead --json

# After
dot tx 0x1f00... --to-yaml
dot tx.System.remark 0xdead --to-json
```
