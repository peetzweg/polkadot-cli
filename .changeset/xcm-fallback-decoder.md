---
"polkadot-cli": patch
---

Add fallback call decoder for XCM and complex types. When the primary view-builder decoder crashes (e.g. on `PolkadotXcm.limited_teleport_assets`), the CLI now falls back to `DynamicBuilder.buildDefinition()` which correctly handles these calls. Previously, complex XCM calls would show "(unable to decode)" in dry-run and transaction output.
