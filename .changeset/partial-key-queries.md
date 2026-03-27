---
"polkadot-cli": minor
---

Support partial key queries for multi-key storage maps (NMaps). You can now pass fewer key arguments than expected to retrieve all entries matching that prefix via `getEntries()`, without requiring `--dump`. For example, querying a 2-key map with only the first key returns all entries under that prefix.
