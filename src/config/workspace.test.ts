import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { withDotHome } from "../test-helpers/with-dot-home.ts";
import { describeConfigDir, resolveConfigDir } from "./store.ts";
import { findWorkspace } from "./workspace.ts";

// Layout used by most tests:
//   <base>/home/                fake home directory (walk-up boundary)
//   <base>/home/project/        a directory with a workspace
//   <base>/home/project/sub/    nested directory inside it
function makeTree() {
  // realpath: macOS tmpdir is a /var → /private/var symlink and findWorkspace
  // canonicalizes, so expectations must be built from the real path.
  const base = realpathSync(mkdtempSync(join(tmpdir(), "dot-workspace-")));
  const home = join(base, "home");
  const project = join(home, "project");
  const sub = join(project, "sub");
  mkdirSync(sub, { recursive: true });
  return { base, home, project, sub };
}

const trees: string[] = [];
function tree() {
  const t = makeTree();
  trees.push(t.base);
  return t;
}
afterAll(() => {
  for (const base of trees) rmSync(base, { recursive: true, force: true });
});

describe("findWorkspace", () => {
  test("finds .polkadot in the start directory", () => {
    const { home, project } = tree();
    mkdirSync(join(project, ".polkadot"));
    expect(findWorkspace(project, home)).toBe(join(project, ".polkadot"));
  });

  test("finds .polkadot in a parent directory", () => {
    const { home, project, sub } = tree();
    mkdirSync(join(project, ".polkadot"));
    expect(findWorkspace(sub, home)).toBe(join(project, ".polkadot"));
  });

  test("nearest workspace wins when nested", () => {
    const { home, project, sub } = tree();
    mkdirSync(join(project, ".polkadot"));
    mkdirSync(join(sub, ".polkadot"));
    expect(findWorkspace(sub, home)).toBe(join(sub, ".polkadot"));
  });

  test("returns null when no workspace exists up to home", () => {
    const { home, sub } = tree();
    expect(findWorkspace(sub, home)).toBeNull();
  });

  test("a .polkadot regular file is not a workspace", () => {
    const { home, project, sub } = tree();
    writeFileSync(join(sub, ".polkadot"), "not a directory");
    mkdirSync(join(project, ".polkadot"));
    expect(findWorkspace(sub, home)).toBe(join(project, ".polkadot"));
  });

  test("never discovers $HOME/.polkadot — that is the global config", () => {
    const { home, sub } = tree();
    mkdirSync(join(home, ".polkadot"));
    expect(findWorkspace(sub, home)).toBeNull();
  });

  test("returns null when starting in home itself", () => {
    const { home } = tree();
    mkdirSync(join(home, ".polkadot"));
    expect(findWorkspace(home, home)).toBeNull();
  });

  test("walks up to the filesystem root when outside home", () => {
    // start dir is NOT under the (unrelated) home, so the walk passes the
    // tree base and only stops at the filesystem root.
    const { base, project, sub } = tree();
    const unrelatedHome = join(base, "elsewhere");
    mkdirSync(unrelatedHome);
    mkdirSync(join(project, ".polkadot"));
    expect(findWorkspace(sub, unrelatedHome)).toBe(join(project, ".polkadot"));
  });
});

describe("resolveConfigDir", () => {
  test("DOT_HOME takes precedence over a discovered workspace", async () => {
    const { project } = tree();
    mkdirSync(join(project, ".polkadot"));
    await withDotHome("/custom/dot-home", async () => {
      const resolved = resolveConfigDir(project);
      expect(resolved).toEqual({ path: "/custom/dot-home", source: "env" });
      expect(describeConfigDir(resolved)).toBe("DOT_HOME /custom/dot-home");
    });
  });

  test("discovered workspace takes precedence over global when DOT_HOME is unset", async () => {
    const { project, sub } = tree();
    const workspace = join(project, ".polkadot");
    mkdirSync(workspace);
    await withDotHome(
      "ignored",
      async () => {
        const resolved = resolveConfigDir(sub);
        expect(resolved).toEqual({ path: workspace, source: "workspace" });
        expect(describeConfigDir(resolved)).toBe(`workspace ${workspace}`);
      },
      { DOT_HOME: undefined },
    );
  });

  test("falls back to global ~/.polkadot without DOT_HOME or workspace", async () => {
    // tmpdir() is outside $HOME and has no .polkadot ancestor.
    const cwd = realpathSync(mkdtempSync(join(tmpdir(), "dot-no-workspace-")));
    trees.push(cwd);
    await withDotHome(
      "ignored",
      async () => {
        const resolved = resolveConfigDir(cwd);
        expect(resolved).toEqual({ path: join(homedir(), ".polkadot"), source: "global" });
        expect(describeConfigDir(resolved)).toBe(`global config ${join(homedir(), ".polkadot")}`);
      },
      { DOT_HOME: undefined },
    );
  });

  test("empty-string DOT_HOME is treated as unset", async () => {
    const { project } = tree();
    const workspace = join(project, ".polkadot");
    mkdirSync(workspace);
    await withDotHome(
      "ignored",
      async () => {
        expect(resolveConfigDir(project)).toEqual({ path: workspace, source: "workspace" });
      },
      { DOT_HOME: "" },
    );
  });
});
