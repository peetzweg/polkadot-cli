---
"polkadot-cli": patch
---

Fix Binary values (e.g. token `symbol` and `name` fields) displaying as `{}` in query and transaction output. Binary instances now render as human-readable text when valid UTF-8, or as hex strings otherwise.
