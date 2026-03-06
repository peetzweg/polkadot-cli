---
"polkadot-cli": minor
---

Add environment-variable-backed accounts with `dot account add <name> --env <VAR>`. Instead of storing secrets on disk, the CLI stores a reference to an environment variable and reads the secret at signing time. Ideal for CI/CD pipelines and security-conscious workflows. The `account list` command shows an `(env: VAR)` badge for these accounts and resolves addresses live when the variable is set.
