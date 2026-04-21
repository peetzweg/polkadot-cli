---
"polkadot-cli": patch
---

Fix `extensions` help and docs that assumed the removed default chain.

After the default-chain removal every chain-consuming command requires
`--chain <name>` or a `<chain>.` dotpath prefix. A few surfaces introduced
alongside `dot extensions` were still suggesting commands without either:

- The custom-extension detail view's `--ext` Usage hint now includes the
  resolved chain (`dot <chain>.tx.<Pallet>.<Call> --from <acc> --ext ...`).
- The "transaction extensions have no sub-items" error now preserves the
  chain the user supplied — prefix form when they used a `<chain>.` prefix,
  `--chain <name>` when they used the flag, and a `<chain>` placeholder
  when neither was set.
- The top-of-file feature bullet in `README.md` and `docs/content/_index.md`
  reads `dot <chain>.extensions` instead of `dot extensions`.
