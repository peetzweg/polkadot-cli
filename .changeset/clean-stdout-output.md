---
"polkadot-cli": patch
---

Remove `chain: <name>` output from `query` and `const` commands. Previously, both commands printed the chain name to stdout (in pretty mode) or stderr (in JSON mode) before the result. This broke piping to `jq` and other tools that expect clean, parseable output. Stdout now contains only the query/constant result, making `dot query ... | jq` and `dot const ... | jq` work out of the box.
