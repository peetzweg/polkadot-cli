---
"polkadot-cli": minor
---

Remove `--limit` option from map queries.

The `--limit` flag only truncated displayed results after all entries were already fetched from the chain, providing no performance benefit. The default limit of 100 silently hid results, which could confuse users who didn't realize their output was truncated.

All map query results are now returned in full. Users who want to limit output can pipe through standard Unix tools (e.g. `| head -n 10` or `| jq '.[0:5]'`).
