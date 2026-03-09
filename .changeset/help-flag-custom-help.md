---
"polkadot-cli": patch
---

Fix `--help` flag on subcommands (`dot account --help`, `dot chain --help`, `dot hash --help`) to show the same detailed custom help as running the bare command instead of CAC's generic auto-generated help.
