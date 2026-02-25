---
"polkadot-cli": minor
---

feat: support raw SCALE-encoded call hex in `dot tx`

Users can now submit pre-encoded calls directly:

```bash
dot tx 0x0503008eaf04151687736326c9fea17e25fc5287613693c912909cb226aa4794f26a48070010a5d4e8 --from alice
```

Both raw hex and `Pallet.Call` forms now display a decoded human-readable representation of the call.
