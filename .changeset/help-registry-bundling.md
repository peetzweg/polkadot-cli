---
"polkadot-cli": patch
---

Fix nested `--help` being dropped in the published bundle. The per-command help registry from the previous fix relied on a module-level `Map`, which `bun build` duplicated (the module is imported both directly and via the `platform/index.ts` barrel) — `withHelp` populated one copy while `printMatchedCommandHelp` read an empty other copy, so `dot account add --help` still ran the action and errored in `dist/cli.mjs` even though the source and tests were green. The help printer is now stored on the `cac` command instance under a `Symbol.for` key, which is immune to module duplication. A post-build smoke test (`src/cli.smoke.test.ts`) now exercises the built bundle under `node` so this class of bundler-only regression is caught.
