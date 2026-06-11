import { realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

export const WORKSPACE_DIR_NAME = ".polkadot";

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Resolve symlinks so boundary comparisons work — e.g. macOS reports
 * process.cwd() under /private/var while $TMPDIR/$HOME may say /var.
 */
export function canonicalPath(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
}

/**
 * Walk up from `startDir` looking for a local `.polkadot/` workspace
 * directory (git-style discovery). Nearest match wins.
 *
 * The walk never inspects `$HOME` itself — `~/.polkadot` is the global
 * config root, not a workspace — and stops there when `startDir` is inside
 * the home directory. Outside of home (e.g. /tmp scratch dirs) it walks up
 * to the filesystem root. A `.polkadot` regular file is ignored.
 */
export function findWorkspace(startDir: string, home: string = homedir()): string | null {
  const homePath = canonicalPath(home);
  let dir = canonicalPath(startDir);
  while (dir !== homePath) {
    const candidate = join(dir, WORKSPACE_DIR_NAME);
    if (isDirectory(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null; // reached the filesystem root
    dir = parent;
  }
  return null;
}
