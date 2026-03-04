---
"polkadot-cli": minor
---

Add chain-prefix syntax for `query`, `const`, `tx`, and `inspect` commands. Instead of using `--chain`, you can now prefix the target with the chain name: `dot query kusama.System.Account <addr>`, `dot const kusama.Balances.ExistentialDeposit`, `dot inspect kusama.System`. The `--chain` flag and default chain remain as fallbacks. If both a chain prefix and `--chain` flag are provided, the CLI errors with a clear message.
