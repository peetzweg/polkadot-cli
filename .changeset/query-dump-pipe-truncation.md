---
"polkadot-cli": patch
---

Fix `dot query <Pallet.Item> --dump --json | jq` failing with
`jq: parse error: Unfinished JSON term at EOF` on populated storage maps
(reported against `polkadot-asset-hub query.Revive.AccountInfoOf`).

```bash
# Now works (previously truncated past ~64 KiB of output):
dot --chain polkadot-asset-hub query.Revive.AccountInfoOf --dump --json | jq
```

Bun's `console.log` writes to `process.stdout` are async, and the CLI returns
before the userspace stdout buffer drains into the OS pipe; on Linux
(~64 KiB pipe buffer) anything past that threshold gets dropped. PR #194
fixed this for `dot metadata` with a local awaitable-write helper. This
extracts that helper into `src/core/output.ts` as a shared `writeStdout`
primitive and routes `dot query`'s five output sites through it (the
`--dump` map-entries path that triggers the user's bug, the single-value
fetch, and the three pallet/storage listing paths). `dot metadata` now
imports the shared helper instead of carrying its own copy.

Issue #198 stays open as the forward-looking sweep — `inspect`, `const`,
`apis`, etc. still emit via `console.log`, but their payloads don't
realistically cross the pipe-buffer threshold today, so they're left for
when (or if) one of them grows.
