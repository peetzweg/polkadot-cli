---
"polkadot-cli": patch
---

Fix case-insensitive chain name resolution. Chain names like `Polkadot`, `POLKADOT`, or `Kusama` now resolve correctly in `--chain` flags, chain prefixes (e.g. `Polkadot.System.Number`), `chain default`, and `chain remove`.
