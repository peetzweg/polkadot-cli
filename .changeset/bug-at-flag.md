---
"polkadot-cli": minor
---

fix(query, apis): honor `--at <block>` for historical reads

`--at` was declared on the global command but only ever wired into `tx`
submission. `query.*` and `apis.*` accepted the flag silently and read
current head anyway, making historical state reads and per-block runtime
API replays impossible from the high-level wrappers.

papi v2 supports historical reads natively via the trailing `PullOptions`
argument on storage and runtime calls (`{ at: "best" | "finalized" |
<hash> }`). The fix threads the flag through.

- `dot polkadot.query.System.Number --at best`
- `dot polkadot.query.System.Number --at finalized`
- `dot polkadot.query.System.Number --at 0x<hash>`
- `dot polkadot.apis.Core.version --at 0x<hash>`

Behavior matrix:

| Command | `--at best` | `--at finalized` | `--at 0x<hash>` |
|---|---|---|---|
| `query.*` | ✓ | ✓ | ✓ |
| `apis.*`  | ✓ | ✓ | ✓ |
| `tx.*`    | rejected (papi v2 constraint) | ✓ | ✓ |

Also fixes a pre-existing CAC/mri argv-parsing bug where 0x-hex block
hashes passed to `--at` were silently coerced to JS Numbers, losing
precision. `--at` is now read from raw argv to keep the original string
intact.

papi v2's `chainHead_v1_*` JSON-RPC only serves pinned (recent) blocks.
For deep historical reads, point `--rpc` at an archive endpoint.
