import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

// DOT_HOME integration tests. These run user-code in a SUBPROCESS so env
// mutation cannot leak into other tests under `bun test --concurrent`.
// Each test gets its own fresh Bun process with its own env.

const CLI_PATH = join(import.meta.dir, "../cli.ts");

async function runWithEnv(
  args: string[],
  env: Record<string, string | undefined>,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(["bun", CLI_PATH, ...args, "--chain", "polkadot"], {
    env: { ...process.env, ...env },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout as ReadableStream).text(),
    new Response(proc.stderr as ReadableStream).text(),
  ]);
  const exitCode = await proc.exited;
  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode };
}

// @ts-expect-error Bun supports describe(label, options, fn) at runtime
describe("DOT_HOME", { timeout: 15_000 }, () => {
  test("writes account state to $DOT_HOME, not $HOME/.polkadot", async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), "dot-home-fake-home-"));
    const dotHome = mkdtempSync(join(tmpdir(), "dot-home-override-"));
    try {
      const { exitCode } = await runWithEnv(["account", "create", "scratch-acct", "--json"], {
        HOME: fakeHome,
        DOT_HOME: dotHome,
      });
      expect(exitCode).toBe(0);

      // Write landed under DOT_HOME
      expect(existsSync(join(dotHome, "accounts.json"))).toBe(true);
      const saved = JSON.parse(readFileSync(join(dotHome, "accounts.json"), "utf-8"));
      expect(saved.accounts).toHaveLength(1);
      expect(saved.accounts[0].name).toBe("scratch-acct");

      // And absolutely NOT under HOME/.polkadot (the original bug)
      expect(existsSync(join(fakeHome, ".polkadot", "accounts.json"))).toBe(false);
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
      rmSync(dotHome, { recursive: true, force: true });
    }
  });

  test("empty-string DOT_HOME falls back to $HOME/.polkadot (does not target /)", async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), "dot-home-empty-"));
    try {
      const { exitCode } = await runWithEnv(["account", "create", "fallback-acct", "--json"], {
        HOME: fakeHome,
        DOT_HOME: "",
      });
      expect(exitCode).toBe(0);
      // Fell back to HOME/.polkadot, NOT to / (which would error with EACCES
      // or scatter files in the filesystem root).
      expect(existsSync(join(fakeHome, ".polkadot", "accounts.json"))).toBe(true);
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
    }
  });

  test("unset DOT_HOME falls back to $HOME/.polkadot", async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), "dot-home-unset-"));
    try {
      const { exitCode } = await runWithEnv(["account", "create", "default-acct", "--json"], {
        HOME: fakeHome,
        DOT_HOME: undefined,
      });
      expect(exitCode).toBe(0);
      expect(existsSync(join(fakeHome, ".polkadot", "accounts.json"))).toBe(true);
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
    }
  });

  test("a default-HOME run leaves the real ~/.polkadot/accounts.json untouched when DOT_HOME is set", async () => {
    // Proves the "don't clobber the real file" guarantee users care about.
    const dotHome = mkdtempSync(join(tmpdir(), "dot-home-guard-"));
    const realAccountsPath = join(homedir(), ".polkadot", "accounts.json");
    const before = existsSync(realAccountsPath) ? readFileSync(realAccountsPath, "utf-8") : null;
    try {
      const { exitCode } = await runWithEnv(["account", "create", "guard-acct", "--json"], {
        DOT_HOME: dotHome,
      });
      expect(exitCode).toBe(0);
      const after = existsSync(realAccountsPath) ? readFileSync(realAccountsPath, "utf-8") : null;
      expect(after).toBe(before);
      // And the account did land under DOT_HOME.
      expect(existsSync(join(dotHome, "accounts.json"))).toBe(true);
    } finally {
      rmSync(dotHome, { recursive: true, force: true });
    }
  });
});
