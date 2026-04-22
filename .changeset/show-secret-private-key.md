---
"polkadot-cli": minor
---

Add `--show-secret` to `dot account inspect`.

Prints the **64-byte sr25519 expanded secret key** as `0x`-prefixed hex
alongside the public key and SS58 address. Works for dev accounts
(Alice/Bob/Charlie/Dave/Eve/Ferdie, derived on-the-fly) and for stored
accounts that have a resolvable secret (mnemonic or hex seed). Refuses on
watch-only accounts, bare SS58 addresses, or hex public keys.

The emitted hex is the final secret after any derivation path is applied, so
it can be pasted directly into signers that don't accept a mnemonic+path
combination (e.g. services that expect a raw `PRIVATE_KEY` env var). In
`--json` mode the value is surfaced under the `privateKey` field.
