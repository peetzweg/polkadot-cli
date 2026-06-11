# Plan: directory-local workspaces (`dot init` / `dot which`)

Refines issue #223. Decided in a grilling session on 2026-06-11.

## Design decisions (final)

1. **One feature, not two.** Persistent venv-style workspaces; the ephemeral-session
   use case from #223 becomes a recipe (`mkdir tmp && cd tmp && dot init`, delete when
   done). No session registry, lifecycle, or GC code.
2. **Discovery: git-style walk-up.** `dot` searches cwd, then parents, for a
   `.polkadot/` directory; nearest wins. The walk stops at `$HOME` (exclusive — the
   global `~/.polkadot` is never discovered as a workspace) or the filesystem root.
   Precedence: `DOT_HOME` env (explicit override, backwards compatible) → discovered
   workspace → global `~/.polkadot`.
3. **Full isolation.** An active workspace is the entire world: accounts, custom
   chains, metadata cache all local; global config invisible. No fallback resolution —
   `sudo` in `~/dot/paseo` and `sudo` in `~/dot/mytestnet` are unrelated identities.
   Built-in default chains still work (compiled in).
4. **`dot init` is minimal.** Creates an empty `.polkadot/` in cwd. No `--from-global`
   copying, no `.gitignore` writing — committing or ignoring the workspace is the
   user's conscious decision. Flags can come later from real usage.
5. **`dot init` edge cases** (be explicit, never surprising):
   - `.polkadot/` already exists in cwd → error.
   - cwd is `$HOME` → hard error (`~/.polkadot` is the global config).
   - Nested inside another workspace → allowed, with a note that it shadows the parent.
   - `DOT_HOME` is set → created anyway, with a warning that discovery is masked.
   - Success output points at `dot which`.
6. **`dot which`** (new command): prints the active config root and how it was chosen
   (`DOT_HOME` / local workspace / global). No banners on normal commands; instead,
   account/chain resolution errors name the config root they searched.
7. **Trust model: none needed.** Same convention as cargo/npm in-repo config —
   declarative JSON only, nothing leaks out, signing requires accounts deliberately
   added to that workspace.

## Implementation

- `src/config/workspace.ts` (new): `findWorkspace(startDir, home?)` — sync stat
  walk-up; only directories count; skips `$HOME` itself; stops at root.
- `src/config/store.ts`: `getConfigDir()` gains the discovery step between the
  `DOT_HOME` check and the global fallback. New `resolveConfigDir(cwd?)` returns
  `{ path, source: "env" | "workspace" | "global" }` for `dot which` and error
  messages.
- `src/commands/workspace.ts` (new): `registerWorkspaceCommands(cli)` with `init`
  and `which`. Logic split into exported, unit-testable functions; thin CAC handlers.
- `src/cli.ts`: register commands, extend `printHelp()`.
- `src/completions/complete.ts`: add `init`, `which` to `NAMED_COMMANDS`.
- `src/core/accounts.ts`: factor the duplicated unknown-account error into one helper
  and append the searched config root (workspace path / DOT_HOME / global).
- `src/config/store.ts` `resolveChain()`: same enrichment for unknown chains.

## Test hermeticity (important)

Walk-up discovery means a test running with a faked `$HOME` but cwd inside the repo
can walk **past** the fake home up to the real `~/.polkadot` and write there. Fixes:

- `src/commands/__fixtures__/run-cli.ts`: spawn with `cwd: tmpHome`.
- `src/config/dot-home.test.ts`: spawn with an explicit tmp cwd.

## Tests

- `src/config/workspace.test.ts`: unit tests for `findWorkspace` (found in cwd,
  found in parent, nearest wins, `.polkadot` file ignored, stops at home, walks to
  root outside home, cwd == home).
- `src/config/store.test.ts` (extend): `resolveConfigDir` precedence env → workspace
  → global.
- `src/commands/workspace.test.ts`: unit tests for init logic (success, exists,
  home-dir error, shadow note, DOT_HOME warning) + subprocess integration tests
  (`dot init` → `dot which`; account created inside a workspace lands in the
  workspace and not in `$HOME/.polkadot`; `DOT_HOME` beats a discovered workspace).
- Coverage must not decrease (codecov project threshold 2%); discovery + command
  logic are unit-tested in-process so they count.

## Docs

- `README.md`: new "Local workspaces" subsection in Configuration; update the
  `DOT_HOME` section with the precedence order; mention `init`/`which` in the
  commands list.
- `docs/content/_index.md`: mirror the README changes.
- `dot-cli/SKILL.md`: add a workspace section (agents should `dot which` to orient,
  `dot init` for isolated per-network setups).
- Changeset: minor bump.
