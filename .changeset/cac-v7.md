---
"polkadot-cli": patch
---

Upgrade `cac` from `6.7.14` to `7.0.0` (major version bump of an internal dependency). cac v7 is ESM-only (the CLI is already ESM) and its auto-generated help/version output now writes via `console.info` instead of `console.log`. No user-visible CLI behavior changes: the same commands, flags, help text, version string, and exit codes are preserved.
