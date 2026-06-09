---
"polkadot-cli": minor
---

feat(account): reveal mnemonic with `--show-secret` and import raw private keys

`dot account inspect <name> --show-secret` now also reveals the **stored
mnemonic** (or 32-byte hex seed) alongside the 64-byte sr25519 expanded private
key, in both text and `--json` output. Env-backed secrets stay redacted — only
the `$VAR` reference is shown.

`dot account add <name> --secret 0x<128 hex>` now imports an account directly
from a 64-byte sr25519 **expanded secret** — the exact value `--show-secret`
prints — making it round-trippable. Imported expanded-secret accounts sign and
resolve addresses like any other signer. A derivation path cannot be applied to
an expanded secret, so `--path` is rejected for this format.

Fixes a related bug: `--secret 0x...` was previously corrupted by `cac`'s
numeric coercion, so **32-byte hex seed import never worked from the command
line**. The raw argv value is now read directly, so both hex seeds and raw
private keys import correctly. The misleading "hex seed not supported" help text
has been corrected.
