---
"polkadot-cli": minor
---

Add `DOT_HOME` environment variable to redirect the CLI's config directory.

When `DOT_HOME` is set, the CLI reads and writes all state — `config.json`,
`accounts.json`, `update-check.json`, and `chains/*/metadata.bin` — under that
directory instead of the default `$HOME/.polkadot`. No `.polkadot` suffix is
appended to the override.

This lets you run experiments, CI jobs, or secondary profiles without touching
your real config directory:

```bash
DOT_HOME=/tmp/dot-scratch dot account create throwaway
```

Empty-string `DOT_HOME=""` is treated as unset and falls back to
`$HOME/.polkadot`, so a shell-quoting slip cannot accidentally target `/`.

The project's own `runCli` test fixture now sets `DOT_HOME` to an isolated
tmpdir for every subprocess it spawns.
