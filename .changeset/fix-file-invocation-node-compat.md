---
"polkadot-cli": patch
---

Fix file-based command invocation when running under Node.js and preserve hex variable values.

- Replace Bun-specific APIs (`Bun.file`, `Bun.stdin`) with Node.js-compatible equivalents (`node:fs/promises`, `process.stdin`) so `dot ./file.yaml` works when installed from npm
- Preserve hex `--var` values (e.g. `--var CALL=0xdeadbeef`) as strings in YAML files — previously YAML's core schema silently converted `0x…` to integers, dropping leading zeros and breaking encoded call data
- Improve the "undefined variable" error message with a structured, multiline format listing all resolution options
