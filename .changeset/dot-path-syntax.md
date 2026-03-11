---
"polkadot-cli": major
---

Restructure CLI to use dot-path syntax. Categories (`query`, `tx`, `const`, `events`, `errors`) are now part of the dot-separated path instead of separate top-level commands.

**Before:** `dot query System.Account <addr>`, `dot tx Balances.transfer_keep_alive <dest> <amount>`
**After:** `dot query.System.Account <addr>`, `dot tx.Balances.transfer_keep_alive <dest> <amount>`

New features:
- Chain prefix is now a 4-segment path: `dot polkadot.query.System.Account`
- Category-only invocation lists pallets: `dot query` lists pallets with storage items
- Pallet-only invocation lists items: `dot query.System` lists storage items, `dot tx.Balances` lists calls
- `explore` alias for `inspect`: `dot explore` and `dot explore System` work like `dot inspect`
- Category aliases work in dot-paths: `consts`, `constants`, `event`, `error`

Removed top-level commands: `call`/`calls`, `event`/`events`, `error`/`errors`, `storage`, `pallet`/`pallets`, standalone `query`, `tx`, `const`/`consts`/`constants`. Use the new dot-path syntax instead.

Kept commands: `inspect` (+ `explore` alias), `chain`, `account`, `hash`.
