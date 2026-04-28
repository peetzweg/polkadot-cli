---
"polkadot-cli": minor
---

Add `dot metadata <chain>` command and detect stale local metadata after a failed call.

**`dot metadata <chain>`**

A new top-level command that fetches a chain's runtime metadata and prints it as a single JSON blob with everything needed to drive the chain — pallets (with calls, events, errors, storage, constants), runtime APIs, transaction extensions, and a runtime fingerprint header (`specVersion`, `transactionVersion`, `codeHash`, etc.). Closes [#170](https://github.com/peetzweg/polkadot-cli/issues/170).

```bash
dot metadata polkadot                  # decoded JSON, fetched fresh from the chain
dot metadata polkadot --raw            # SCALE-encoded metadata bytes as a single 0x… hex line
dot metadata polkadot --cached         # use locally cached metadata, skip the network round-trip
dot metadata polkadot --rpc wss://…    # override the RPC endpoint
```

**Stale-metadata suggestion**

When `dot tx`, `--dry-run`, or `dot query` fails with an error that smells like stale metadata (a runtime wasm trap, codec/decode failure, or fee-estimation panic), the CLI now compares your local metadata's runtime fingerprint against the live chain. If it has changed, the original error is wrapped with a one-line suggestion telling you exactly which command to run:

```
Error: The runtime rejected this transaction in the runtime's validate_transaction step.
  Cause: a runtime invariant failed — typically the call's arguments are out of range, …

⚠ Local metadata for "paseo-people-next" is out of date (spec 1018 → 1020).
   Run: dot chain update paseo-people-next
```

The fingerprint includes the runtime **code hash** (from `state_getStorageHash(":code:")`) — so the check also catches local-node restarts where the runtime wasm changed but `specVersion` was kept the same. No automatic refetch happens; the suggestion is shown once and the original error still propagates with the non-zero exit code.

The check only fires on suspected-stale errors, so the happy path pays no extra RPC. Set `DOT_TRUST_CACHED_METADATA=1` to skip the check entirely (e.g. for CI or scripted loops where you've just refreshed manually).

**Companion improvements**

- `formatRuntimeError` now translates raw polkadot-api wasm-trap stack traces into a friendly "the runtime rejected this transaction" message with a hint pointing at `--dry-run`.
- `dot tx --dry-run` now surfaces the underlying reason when fee estimation fails (previously the error message was silently dropped, leaving only "unable to estimate").
- A global `unhandledRejection` filter swallows benign late-timer rejections from `@polkadot-api/observable-client` (`Not connected`, `DisjointError`) that previously crashed `dot chain update --all` after the actual work had completed.
