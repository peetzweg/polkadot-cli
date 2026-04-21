---
"polkadot-cli": minor
---

Improve `dot chain import` and `dot account import` UX.

**Readable output.** Both commands now print one line per chain/account with
status glyphs — `✓` added, `⟳` overwritten, `-` skipped — followed by a terse
count summary. The old single-line comma-joined `Added: a, b, c, …` summary
could span hundreds of characters for realistic imports; per-item lines are
much easier to scan.

```
  ✓ preview
  ✓ preview-people
  ⟳ polkadot (overwritten)
  - paseo (skipped)

2 added, 1 overwritten, 1 skipped
```

**No more hangs on bare invocation.** `dot chain import` and
`dot account import` with no file argument used to block forever reading
from stdin. They now print the subcommand help when invoked in a terminal,
while piped stdin (`cat file | dot chain import` or `dot chain import -`)
still works.

**Auto-metadata after chain import.** `dot chain import` now fetches metadata
for newly imported or overwritten chains automatically, so tab completion,
`dot chain.query.*`, and other metadata-dependent features start working
immediately — no manual `dot chain update --all` step required. Pass
`--no-metadata` to skip the fetch (useful for offline/CI bootstrapping).

**`dot account import` is now file-only.** The single-account import form
`dot account import <name> --secret "..."` / `--env VAR` has been removed to
make the command a clean analog to `dot chain import`. The canonical
single-account path is and remains `dot account add <name> --secret "..."`
(`add --secret` / `add --env` have always been supported). Batch file import
no longer requires the `--file` flag — just pass the path:

```bash
# Before
dot account import treasury --secret "word1 word2 ..."    # no longer works
dot account import --file accounts.json                    # still works

# After
dot account add treasury --secret "word1 word2 ..."        # canonical single
dot account import accounts.json                           # positional file
dot account import accounts.json --overwrite --dry-run
dot account import -                                       # stdin
```
