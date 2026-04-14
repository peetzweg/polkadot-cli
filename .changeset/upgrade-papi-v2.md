---
"polkadot-cli": minor
---

Upgrade to polkadot-api (PAPI) v2. This brings performance improvements, a simplified provider stack, and aligns with the latest Polkadot ecosystem tooling.

**Dependency changes**

- `polkadot-api` upgraded from v1 to v2
- `@polkadot-api/metadata-builders`, `@polkadot-api/substrate-bindings`, and `@polkadot-api/view-builder` upgraded to v2-compatible versions
- Removed `ws` dependency — PAPI v2 auto-detects the native WebSocket implementation (Node 22+, Bun)
- Removed `withPolkadotSdkCompat` wrapper — no longer needed in v2

**Breaking: `--at best` removed**

The `--at best` transaction option is no longer supported. PAPI v2 only accepts specific block hashes for the `--at` flag. Use `--at <0x...block-hash>` or omit `--at` entirely (defaults to the finalized block).

```bash
# Before
dot tx System.remark 0xdead --from alice --at best

# After — omit --at for finalized (default), or pass a specific block hash
dot tx System.remark 0xdead --from alice
dot tx System.remark 0xdead --from alice --at 0xabc...
```

`--at finalized` is still accepted for clarity but is equivalent to omitting the flag.

**Internal changes**

- Binary values from the runtime are now `Uint8Array` (previously `Binary` class instances). Display behavior is unchanged — text-like bytes render as text, others as hex.
- Constants are now accessed via `getStaticApis()` instead of the removed `runtimeToken`.
- WebSocket provider imported from `polkadot-api/ws` (previously `polkadot-api/ws-provider`).
