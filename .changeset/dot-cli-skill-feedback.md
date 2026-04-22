---
"polkadot-cli": patch
---

Polish the `dot-cli` Claude Code skill based on first-contact evaluation feedback. No CLI behavior changes.

**SKILL.md**

- Fix the `Inspect / Explore` section: the old `dot <chain>.inspect` dotpath form does not parse; show the two valid forms (`dot inspect <Pallet> --chain <name>` and chain-prefixed target `dot inspect <chain>.<Pallet>`), and call out that a bare `dot inspect <chain>` is parsed as a pallet name.
- Add a `Complex Arguments` subsection under `Runtime APIs` with a worked `Location` example showing the `{type, value}` enum shape, so first-time users don't have to reverse-engineer XCM location JSON from `--dump` output.
- Document that `--at <block>` is a tx flag only; queries always read the latest finalized head. Add `--at` to the Key Flags table.
- Add a short `Common Errors` appendix (`Incompatible runtime entry`, unknown account, `undefined` piped into `jq`, metadata decode drift after runtime upgrades).
- Replace the one-line pointer to `references/scripting-patterns.md` with three inline highlights so users know whether to click through.

**Tests**

- Extend `src/skill-marketplace.test.ts` with a regression test that asserts SKILL.md no longer contains the stale `<chain>.inspect` dotpath form, plus positive checks for the new content areas.
