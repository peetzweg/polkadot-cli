---
"polkadot-cli": minor
---

Add `--yaml` and `--json` flags to decode transaction call data into file-compatible formats.

- `dot tx.0x1f0003... --yaml` decodes a raw hex call to YAML
- `dot tx.System.remark 0xdead --json` encodes then outputs as JSON
- Output matches the file input format, enabling a round-trip workflow: encode a call, decode to YAML/JSON, tweak parameters, re-execute via file input
- Works offline from cached metadata, does not require `--from`
- Mutually exclusive with `--encode` and `--dry-run`
