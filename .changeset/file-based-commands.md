---
"polkadot-cli": minor
---

Add file-based command input: run any `dot` command from a YAML or JSON file.

- `dot ./transfer.yaml --from alice --dry-run` reads a structured file and routes to the appropriate handler
- Supports all categories: `tx`, `query`, `const`, `apis`
- Shell-style variable substitution with `${VAR}` and `${VAR:-default}` syntax
- Variables resolved from `--var KEY=VALUE` flags, environment variables, or a `vars:` section in the file
- Both `.yaml`/`.yml` and `.json` file formats supported
- All existing CLI flags (`--from`, `--dry-run`, `--encode`, `--chain`, etc.) work with file input
