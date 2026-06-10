---
"polkadot-cli": minor
---

feat(verifiable): ring-VRF proof, signing, verification and members primitives

Adds composable `dot verifiable` subcommands over `verifiablejs`:

- `verifiable sign` / `verify-sig` — standalone Bandersnatch signatures.
- `verifiable alias` — derive the alias for a 32-byte ring context.
- `verifiable prove` / `verify` — ring-VRF proofs (`one_shot`) and local
  verification against a members set or a 768-byte ring root.
- `verifiable members` — SCALE-encode member keys as `Vec<[u8;32]>`.
- `verifiable msg alias` — build the `set_alias_account` / `reprove_alias_account`
  proof message.
- `verifiable ring members|root` — fetch a ring's members (People) or its latest
  root + exponent (Asset Hub) from a chain.

All actions accept hex / `--file` / `--stdin` input and `--output json`, and a
new `src/features/verifiable/lib.ts` exposes the underlying primitives for reuse.

**Breaking:** the entropy-derivation key is now `--entropy-key` (was `--context`
on `dot verifiable`), and `--context` now means the 32-byte ring/proof namespace
— aligning with the runtime (`type Context = [u8;32]`) and the iOS/Android
clients. The old `--context <key>` form still works on the member command for one
release with a deprecation warning; switch to `--entropy-key`.
