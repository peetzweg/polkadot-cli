---
"polkadot-cli": minor
---

Add `--wait` / `-w` flag to control how long `tx` commands wait before returning.

By default, `dot tx` waits for finalization (~30s on Polkadot). The new `--wait` flag lets you choose an earlier resolution point:

```
# Return as soon as the tx is broadcast (fastest)
dot tx.System.remark 0xdead --from alice --wait broadcast

# Return when included in a best block (medium)
dot tx.System.remark 0xdead --from alice -w best-block
dot tx.System.remark 0xdead --from alice -w best   # alias

# Wait for finalization (default, unchanged behavior)
dot tx.System.remark 0xdead --from alice --wait finalized
dot tx.System.remark 0xdead --from alice            # same
```

The output adapts to the wait level:
- **broadcast**: shows tx hash and broadcast status, no events or explorer links
- **best-block**: shows events and explorer links with a "(best block, not yet finalized)" hint
- **finalized**: unchanged behavior with full events and explorer links

Shell completions for `--wait` / `-w` values are included.
