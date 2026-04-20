---
"polkadot-cli": patch
---

Fix broken example commands printed by `dot --help` and the per-item
`--help` views.

The same no-default-chain regression that hit the README also hit the
CLI's own help output:

- **`dot --help`** advertised 9 example commands without a chain
  (`dot query.System.Account <addr>`, `dot tx.System.remark 0xdead --from
  alice`, `dot apis.Core.version`, etc.) — every one errored on a fresh
  install with `No chain specified`. Examples now use the dotpath chain
  prefix (`dot polkadot.query.System.Account <addr>`) for read-only
  commands, the `--chain` flag for `tx`, and demonstrate both forms so
  readers learn the equivalence. The unsigned-tx example also picks a
  preconfigured chain (`polkadot-people`) instead of a placeholder.
- **Item-level help** (`dot tx.System.remark --help --chain polkadot`,
  `dot query.System.Account --help …`, etc.) printed `Usage:` lines
  without a chain. These are now generated using the resolved chain name
  the user just supplied — so the suggested forms always work for the
  chain they were just inspected against. For `tx`, both the dotpath and
  flag forms are shown; for read-only commands, the dotpath form
  (already containing the chain) is used.
- **Raw-call usage hint** (`Extra arguments are not allowed when
  submitting a raw call hex.`) now mentions `--chain <chain>`.
