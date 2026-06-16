---
"polkadot-cli": minor
---

Incomplete commands now print full help instead of a terse error. When a command is invoked without a required positional argument — `dot account add`, `dot account inspect`, `dot chain add`, `dot chain update`, `dot metadata`, `dot completions`, etc. — the CLI now prints the command's complete usage block (the same one shown by `--help`) to stderr and exits 1, rather than a one-line "X is required" hint or a raw `missing required args` error. A short reason (e.g. `Account name is required.`) still leads the output so it's clear what was missing. Explicit `--help` is unchanged: it prints to stdout and exits 0. Missing/invalid options (e.g. `dot chain add foo` without `--rpc`, `dot sign msg` without `--from`) keep their specific targeted errors.
