---
"polkadot-cli": minor
---

Add ergonomic enum shorthand syntax for `dot tx` arguments. Instead of verbose JSON like `'{"type":"system","value":{"type":"Authorized"}}'`, you can now write `'system(Authorized)'`. Supports nested enums, case-insensitive variant matching, JSON inside parens for structs, and empty parens for void variants. All existing formats (JSON, hex, SS58 addresses) continue to work unchanged.
