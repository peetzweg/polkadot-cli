---
"polkadot-cli": patch
---

Fix stdout pollution when piping `--output json` to tools like `jq`. Progress messages ("Fetching metadata...", "Connecting...", spinner output) now go to stderr instead of stdout, following Unix conventions. Commands like `dot const System.SS58Prefix --output json | jq .` now work correctly without JSON parse errors from interleaved progress text.
