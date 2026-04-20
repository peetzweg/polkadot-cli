---
"polkadot-cli": patch
---

Audit and fix every CLI example in `README.md` and `docs/content/_index.md`.
Many examples no longer worked after the no-default-chain change; this
sweep rewrites them so each one runs as written against the current CLI.

What was broken:

- **Missing chain.** `dot apis.ReviveApi.call ...`, `dot query.System.Number`,
  `dot const.Balances.ExistentialDeposit`, etc. — every chain-requiring
  example in the docs lacked an explicit chain. They now use either the
  dotpath chain prefix (`dot polkadot.query.System.Number`) for read-only
  commands or the `--chain` flag for `tx` commands.
- **Invalid chain names.** Examples referenced `kusama`, `assethub-paseo`,
  `people`, `people-paseo`, `people-preview`, and `westend` — none of which
  ship preconfigured. Replaced with valid built-in names (`polkadot`,
  `paseo`, `paseo-asset-hub`, `polkadot-people`); `kusama` is kept only in
  the `dot chain add kusama …` / `dot chain remove kusama` teaching
  examples.
- **Removed-from-CLI commands.** The `dot pallets`, `dot calls`, `dot
  storage` "Focused commands" section documented top-level commands that
  no longer exist. Replaced with the working partial-path forms
  (`dot polkadot.tx`, `dot polkadot.events`, `dot polkadot.query`, etc.).
- **False space-separated claim.** The docs claimed
  `dot query polkadot.System.Account 5Grw…` worked. It doesn't — the
  parser absorbs `polkadot.System.Account` as a pallet name. Replaced
  with the actually-working forms and an explicit warning about the
  broken mixed dotted/space form.
- **Inspect chain prefix.** Clarified that `dot polkadot.inspect.X` is
  not valid (because `inspect` is a top-level command, not a dot-path
  category) and only `dot inspect polkadot.X` or
  `dot inspect X --chain polkadot` work.
- **Item-level help.** `dot tx.System.remark --help` style examples now
  include `--chain` — help still needs the chain to load metadata from
  the cache.

No code changes. Verified by running 22 representative examples against
the local CLI and `bun test` (1284 tests, all pass).
