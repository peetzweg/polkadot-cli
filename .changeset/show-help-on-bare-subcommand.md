---
"polkadot-cli": patch
---

Show help text instead of listing items when running `dot account` or `dot chain` with no action. This is consistent with typical CLI behavior where bare subcommands show usage help. Use `dot account list` or `dot chain list` to list items explicitly.
