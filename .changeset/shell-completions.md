---
"polkadot-cli": minor
---

Add shell completion support for zsh, bash, and fish.

Run `dot completions zsh`, `dot completions bash`, or `dot completions fish` to generate a shell completion script. Tab-complete subcommands, chain names, pallet names, and item names from cached metadata — all offline with no network calls.

Completions are context-aware: `query.` completes pallets with storage items, `tx.` completes pallets with calls, `events.` and `errors.` filter accordingly. Chain prefix paths (`polkadot.query.System.`) and option values (`--chain`, `--from`, `--output`) are also supported.
