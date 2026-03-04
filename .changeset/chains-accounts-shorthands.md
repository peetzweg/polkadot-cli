---
"polkadot-cli": minor
---

Add `dot chains` and `dot accounts` shorthands that list all chains and accounts without the explicit `list` subcommand. Running `dot chain` or `dot account` with no action now also defaults to listing instead of showing help text. `dot chain list` and `dot account list` continue to work as before.
