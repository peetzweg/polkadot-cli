---
"polkadot-cli": patch
---

Preserve the standalone `dot parachain <paraId>` command as a deprecated alias.

The same release that introduced sovereign-account derivation flags on `dot account` (`--parachain` / `--parachain-type` / `--pallet-id`) had also deleted the older standalone `dot parachain` command. To avoid breaking production scripts that pin the prior CLI surface, the command is restored verbatim — same arguments, same exit codes, same byte-identical stdout for `--json` and pretty output. It now prints a one-line deprecation warning to **stderr only**, so pipes into `jq` / `awk` / file redirects keep working unchanged.

Migrate at your convenience:

```bash
# Before
dot parachain 1000 --type child --json

# After (same SS58 / public key, structured `source` field on JSON output)
dot account inspect --parachain 1000 --parachain-type child --json
```

Tracked for removal in a future release: [#208](https://github.com/peetzweg/polkadot-cli/issues/208).
