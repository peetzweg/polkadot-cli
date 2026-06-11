---
"polkadot-cli": minor
---

Add directory-local workspaces: `dot init` creates a `.polkadot/` workspace in the current directory, discovered git-style (cwd and parents, stopping at `$HOME`) and fully isolating accounts, custom chains, and metadata cache from the global `~/.polkadot`. New `dot which` shows the active config root and how it was chosen. Precedence: `DOT_HOME` → local workspace → global. Account and chain resolution errors now name the config root that was searched.
