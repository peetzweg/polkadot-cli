---
"polkadot-cli": patch
---

Fix `--help` being dropped for nested subcommands. Previously `dot account add --help` (and other nested commands like `dot chain add --help`, `dot account inspect --help`, `dot hash <algo> --help`, `dot verifiable <action> --help`) ran the command's action and exited with an error about the missing positional argument instead of printing usage. Now `--help` reliably prints the command's usage block and exits 0 at every nested command level. Commands with a required positional (`dot metadata --help`, `dot completions --help`) also print help instead of erroring.
