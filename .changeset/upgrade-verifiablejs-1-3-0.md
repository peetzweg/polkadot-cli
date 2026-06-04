---
"polkadot-cli": patch
---

chore(deps): upgrade `verifiablejs` to `1.3.0`

Bumps `verifiablejs` from `1.3.0-beta.2` to the stable `1.3.0` release. The JS
API consumed by the CLI (`member_from_entropy`) is unchanged, but the release
bumps the underlying `verifiable` crate to v0.5.0 (ThinVRF, new ring proofs),
so derived Bandersnatch member keys are **wire-incompatible** with `beta.2` —
this is the intended alignment with the `verifiable` crate used on-chain by
`individuality`. Updated the documented example keys (README, docs) and added a
regression test pinning alice's derived member keys to the 1.3.0 wire format.
