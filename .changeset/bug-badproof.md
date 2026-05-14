---
"polkadot-cli": patch
---

fix(tx): show stale-metadata hint on `BadProof` / `AncientBirthBlock`

`withStalenessSuggestion` already wraps every `signSubmitAndWatch` call
and, on error, compares cached `(specVersion, transactionVersion,
codeHash)` against the live runtime — if they diverge it appends the
`⚠ Local metadata for "<chain>" is out of date … Run: dot chain update
<chain>` hint. But the gating regex only matched wasm-trap / codec /
decode symptoms, not `Invalid::BadProof` or `Invalid::AncientBirthBlock`.

After a chain runtime upgrade the signer used the cached spec/tx
version, the runtime reconstructed a different payload, the signature
didn't verify and the tx was rejected with a bare `BadProof` — leaving
the user guessing. The fingerprint mismatch was right there but the
regex skipped over it.

`CheckSpecVersion` / `CheckTxVersion` / `CheckGenesis` /
`CheckMortality` are all in the signed payload, so `BadProof` and
`AncientBirthBlock` are exactly the variants that smell like stale
metadata. Adding them to the pattern list lets the existing fingerprint
gate run; if cached matches live (genuine bad key / wrong chain) the
raw error still passes through unchanged.

Nonce-mismatch variants (`Future`, `Stale`) are deliberately excluded —
those are account-state issues, not metadata.
