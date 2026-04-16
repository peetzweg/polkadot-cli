---
"polkadot-cli": patch
---

Fix `--rpc` override being silently ignored when cached metadata exists for a chain.

Previously, when using `--rpc <url>` to connect to a different endpoint, the CLI would return metadata from a previously cached chain instead of fetching fresh metadata from the specified endpoint. The metadata cache was keyed only by chain name, so `--rpc` pointing to a different chain (e.g. an asset hub parachain cached under the relay chain name) would silently return wrong metadata.

Now, when `--rpc` is explicitly provided, the CLI always fetches fresh metadata from the specified endpoint, bypassing the name-based cache. The freshly fetched metadata is still saved to the cache so subsequent runs without `--rpc` use the updated data.
