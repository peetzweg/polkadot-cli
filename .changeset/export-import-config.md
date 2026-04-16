---
"polkadot-cli": minor
---

Add export/import commands for chain configurations and accounts, enabling portable backup, restore, and team sharing of setups.

**Chain export/import (`dot chain export` / `dot chain import`)**

Export chain configurations to JSON and import them on another machine or share with teammates. Metadata is excluded from exports (re-fetch with `dot chain update --all` after importing).

```bash
# Export custom chains to stdout
dot chain export

# Export all chains (including built-ins) to a file
dot chain export --all --file my-chains.json

# Export specific chains
dot chain export my-relay my-para

# Import from a file
dot chain import my-chains.json

# Preview without applying
dot chain import my-chains.json --dry-run

# Overwrite existing chains
dot chain import my-chains.json --overwrite

# Pipe between machines
ssh remote "dot chain export" | dot chain import -
```

**Account export/import (`dot account export` / `dot account import --file`)**

Export accounts with secrets redacted by default. Redacted accounts import as watch-only, preserving public keys for address resolution without exposing secrets.

```bash
# Export accounts (secrets redacted by default)
dot account export

# Include secrets (explicit opt-in, warning printed)
dot account export --include-secrets --file backup.json

# Export only watch-only accounts (always safe)
dot account export --watch-only

# Batch import from a file
dot account import --file team-accounts.json

# Preview without applying
dot account import --file accounts.json --dry-run

# Overwrite existing accounts
dot account import --file accounts.json --overwrite
```

**Security**: Secrets are redacted (`<redacted>`) by default in exports. `--include-secrets` is required to include actual mnemonics/seeds. Env-backed accounts export the variable *name* (e.g. `{"env": "MY_SECRET"}`), never the value. The existing single-account `import` command (`--secret`/`--env`) is unchanged.
