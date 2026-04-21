---
"polkadot-cli": minor
---

Ship a Claude Code skill for the `dot` CLI, installable as a plugin marketplace directly from this repo.

**New: `dot-cli` Claude Code skill**

The repo now ships a Claude Code skill that teaches agents how to drive the `dot` CLI — query patterns, tx encoding, runtime API calls, XCM locations, and bash scripting gotchas (like the `undefined` sentinel for missing storage keys and u128 quoted-string handling). The skill auto-triggers when Claude is asked about `dot`, polkadot-cli, Substrate storage, extrinsic submission, runtime APIs, or XCM.

Install:

```
/plugin marketplace add peetzweg/polkadot-cli
/plugin install dot-cli@polkadot-cli
```

Update later:

```
/plugin marketplace update polkadot-cli
```

Layout mirrors the [paritytech/product-skills](https://github.com/paritytech/product-skills) marketplace — `.claude-plugin/marketplace.json` with a single `strict: false` plugin entry pointing at `./dot-cli`. The skill folder itself is drop-in compatible with `product-skills`, so later consolidation is a straight copy.
