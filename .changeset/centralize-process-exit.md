---
"polkadot-cli": patch
---

Centralize process.exit(0) in cli.ts so commands exit immediately after completion instead of hanging on polkadot-api timers
