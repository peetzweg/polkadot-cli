---
"polkadot-cli": patch
---

Improve best-effort hex-to-text conversion for Binary values.

Binary fields that contain control characters (C0/C1), DEL, or Private Use Area code points now correctly fall back to hex display instead of rendering as garbled text. This fixes storage keys and other identifiers that start with a text-based prefix but contain binary hash data after it.
