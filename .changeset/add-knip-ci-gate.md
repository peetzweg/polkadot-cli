---
"polkadot-cli": patch
---

chore(ci): gate builds on knip for unused code and dep hygiene

Adds `knip` as a hard-gated CI step that fails on unlisted dependencies,
unlisted binaries, and unused exports. Catches dead code and missing
dependency declarations before they reach `main`.

Fixes the findings the gate surfaced on its first run:

- declare `@polkadot-api/utils` as a direct dependency (was being resolved
  transitively through `polkadot-api`, would break on any upstream
  restructure)
- add `typescript` to `devDependencies` (`tsc` was used by the `typecheck`
  script without an explicit declaration)
- switch `tsconfig.json` `types` from the unlisted `bun-types` to `bun`
  (resolved via the already-declared `@types/bun`)
- demote 15 internal-only symbols from `export` to file-local across
  `accounts-store.ts`, `store.ts`, `metadata.ts`, `output.ts`, `xxh64.ts`,
  `accounts-types.ts`, and `rpc-registry.ts`
- rewrite an inline `import("./...").AccountSource` in `account.ts` as a
  top-of-file `import type`

No CLI behavior change — all 1589 tests pass, line/function coverage
unchanged at 88.43% / 90.54%.
