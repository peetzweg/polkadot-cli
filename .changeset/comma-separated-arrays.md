---
"polkadot-cli": minor
---

Add comma-separated syntax for `Vec<T>` parameters.

Array arguments (like `Utility.batchAll` calls) can now be passed as comma-separated values instead of requiring a JSON array string. This makes composing batch calls from individually encoded calls much more ergonomic:

```bash
A=$(dot tx Balances.transfer_keep_alive 5FHn... 1DOT --encode)
B=$(dot tx System.remark 0xdead --encode)
dot tx Utility.batchAll $A,$B --from alice
```

- Works for any `Vec<T>` parameter (not just batch calls)
- `Vec<u8>` byte arrays are unaffected (still treated as binary)
- JSON array syntax `'[...]'` and file-based input continue to work as before
