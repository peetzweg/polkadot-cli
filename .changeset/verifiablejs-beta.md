---
"polkadot-cli": patch
---

chore(deps): upgrade `verifiablejs` to `1.3.0-beta.2`

Tracks the upstream beta. The CLI only consumes `member_from_entropy`,
whose signature is unchanged, so `dot verifiable` output is byte-identical.
