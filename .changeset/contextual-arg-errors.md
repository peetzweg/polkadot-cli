---
"polkadot-cli": patch
---

Improve argument parsing error messages with contextual information. When `parseTypedArg` fails (e.g. passing `"abc"` where a `Compact<u128>` is expected), the error now includes the argument name (for struct fields) or index (for tuples), the expected type, the invalid value, and a hint describing what the type expects. Previously, errors surfaced as raw JS exceptions (e.g. `Failed to parse String to BigInt`) with no context about which argument failed.
