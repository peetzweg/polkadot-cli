---
"polkadot-cli": patch
---

fix(test): make polkadot-api module mocks ordering-safe across test files

No runtime behavior change — this fixes the flaky CI failures where
`createChainClient` tests failed depending on test-file scheduling order.
bun's `mock.module()` is global to the test process and not restored between
files, so `client.test.ts` and `load-meta.test.ts` clobbered each other's
mocks. Both now share a fixture that spreads the real module exports into
the mocks and captures the real `createChainClient` before any file can stub
the `client.ts` module.
