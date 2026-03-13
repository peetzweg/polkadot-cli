---
"polkadot-cli": minor
---

Add watch-only accounts and named address resolution.

Accounts can now be added without secrets using `dot account add <name> <address>`, storing just the public key as a watch-only entry. Named accounts (both watch-only and keyed) resolve everywhere an AccountId32 is expected — in `dot tx` arguments, `dot query` keys, and MultiAddress auto-wrapping. For example: `dot tx Balances.transferKeepAlive treasury 1000 --from alice` or `dot query System.Account treasury`.

Watch-only accounts show a `(watch-only)` badge in `dot account list`, cannot be used with `--from` (signing), and cannot be used as `derive` sources. The `add` subcommand is now context-sensitive: bare `add <name> <address>` creates a watch-only entry, while `add --secret` or `add --env` imports a keyed account as before.
