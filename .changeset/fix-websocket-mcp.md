---
"polkadot-cli": patch
---

Fix "Missing WebSocket class" error when running in sandboxed environments (e.g. LLM/MCP runtimes, plain Node.js without native WebSocket). The WS provider now explicitly uses the `ws` package instead of relying on `globalThis.WebSocket`.
