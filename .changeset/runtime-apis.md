---
"polkadot-cli": minor
---

Add runtime API calls as new `apis` category. Browse and call Substrate runtime APIs (e.g. `Core.version`, `AccountNonceApi.account_nonce`) directly from the CLI.

- `dot apis` lists all runtime APIs with method counts
- `dot apis.Core` lists methods in a specific API with signatures
- `dot apis.Core.version` calls a runtime API method
- Chain prefix support: `dot polkadot.apis.Core.version`
- `--help` support: `dot apis.Core.version --help`
- Shell completions for API names and method names
- Aliases: `api` and `apis` both work
- Metadata fetching now requests v15 metadata first (required for runtime API info), falling back to v14
- Shows a helpful hint when cached metadata is v14 and does not include runtime APIs
