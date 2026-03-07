---
"polkadot-cli": patch
---

Fix update notification never showing due to a race condition. The background version check now stores its promise and `process.exit()` waits up to 500ms for it to complete, ensuring the cache file is written before exit. Failed checks are cached for 1 hour to avoid repeated delays when the network is down.
