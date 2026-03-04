---
"polkadot-cli": minor
---

Add update notifier that shows a boxed notification when a new version of polkadot-cli is available on npm. The check runs in the background on startup, caches results for 24 hours in `~/.polkadot/update-check.json`, and never blocks the CLI. Disable with `DOT_NO_UPDATE_CHECK=1`; automatically suppressed in CI environments and non-TTY output.
