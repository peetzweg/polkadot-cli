---
"polkadot-cli": patch
---

Show first complete sentence in listing views instead of raw metadata lines. Documentation strings were previously cut at metadata line boundaries, losing information mid-sentence. Listing summaries now join all doc lines and extract the first complete sentence, correctly handling abbreviations like `e.g.`, `i.e.`, and `etc.` so they don't cause early truncation. Type descriptions are no longer truncated either — the terminal handles line wrapping.
