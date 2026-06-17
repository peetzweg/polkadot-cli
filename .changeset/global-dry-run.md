---
"polkadot-cli": minor
---

Add a global `DOT_DRY_RUN` environment variable. When set to a truthy value (`1`, `true`, `yes`, or `on`), every extrinsic-submitting command behaves as if `--dry-run` had been passed — the transaction is simulated and never broadcast. A one-line hint is printed to stderr (keeping `--json`/piped stdout clean). An explicit `--dry-run` / `--no-dry-run` flag always wins, and decode-only paths (`--encode`, `--to-yaml`, `--to-json`) are unaffected.
