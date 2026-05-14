---
"polkadot-cli": minor
---

feat(account): show pallet-revive H160 in `dot account inspect`

Every Substrate account now also shows its pallet-revive 20-byte H160
address (EIP-55 checksummed) on the `H160:` line, so developers working
across SS58 and EVM tooling on Polkadot Hub / Asset Hub can see both
representations side by side. The same H160 appears under the `h160`
field of `--output json`.

The mapping is offline and matches current `polkadot-sdk` master:

- **AccountId32 → H160:** if the last 12 bytes are `0xEE`, strip them
  (the account originated from an Eth address); otherwise
  `keccak256(accountId32)` and take the last 20 bytes.
- **H160 → AccountId32:** deterministic fallback `H160 || 0xEE * 12`.
  The full mapping after `pallet_revive.map_account` lives in on-chain
  `AddressSuffix` storage and is not recoverable offline.

`dot account inspect` accepts a 20-byte H160 hex value as a new input
form. It resolves to the fallback AccountId32 and reports
`Kind: revive H160 fallback`.

```bash
dot account inspect alice
#   H160:        0x9621DDe636dE098B43Efb0fA9b61fAcFE328F99D

dot account inspect 0x9621DDe636dE098B43Efb0fA9b61fAcFE328F99D
#   Kind:        revive H160 fallback
#   Public Key:  0x9621dde636de098b43efb0fa9b61facfe328f99deeeeeeeeeeeeeeeeeeeeeeee

dot account inspect alice --json | jq -r .h160
# 0x9621DDe636dE098B43Efb0fA9b61fAcFE328F99D
```

Older `stable2412` runtimes used plain `accountId32[..20]` truncation
instead of the keccak fallback for the forward direction. A
`--revive-truncate` flag for those is not implemented; this release
ships only the canonical current-master mapping.
