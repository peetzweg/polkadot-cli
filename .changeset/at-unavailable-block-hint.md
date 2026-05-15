---
"polkadot-cli": patch
---

fix(errors): friendlier message when `--at <block>` is not available

When `--at` points at a block the connected RPC can't serve — most often
an old hash against a non-archive node — papi raises
`BlockHashNotFoundError` / `StorageError: UnknownBlock` / "is not pinned"
rejections. These now get caught at the `query.*` / `apis.*` / `tx.*`
call sites and re-surfaced as a clean `CliError` with a copy-pasteable
hint:

```
Error: Block 0x… is not pinned (storage)

⚠ 0x… is not available on the current RPC endpoint.
   Public nodes serve only recent (pinned) blocks via chainHead_v1_*.
   For deep historical reads, point --rpc at an archive endpoint, e.g.:
     dot ... --at 0x… --rpc wss://<archive-endpoint>
```

Note: papi's substrate-client may still emit its own internal stack
trace ahead of the clean message; suppressing that is a separate
follow-up.
