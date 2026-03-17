---
"polkadot-cli": minor
---

Require `--dump` flag for keyless map queries to prevent accidentally fetching all entries.

Running `dot query.System.Account` (a map query without a key) now shows help and usage info instead of fetching every entry via `getEntries()`. This protects users from accidentally triggering slow, expensive full-map dumps on live chains with millions of entries.

To explicitly fetch all entries, pass `--dump`:

```
dot query.System.Account --dump
dot query.System.Account --dump --limit 10
```

Querying a specific key still works as before:

```
dot query.System.Account 5GrwvaEF...
```
