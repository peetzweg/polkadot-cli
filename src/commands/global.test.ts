import { describe, expect, test } from "bun:test";
import { runCli } from "./__fixtures__/run-cli.ts";

describe("global CLI", () => {
  test("no command shows help", async () => {
    const { stdout, exitCode } = await runCli([]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("chain");
    expect(stdout).toContain("account");
    expect(stdout).toContain("inspect");
    expect(stdout).toContain("query");
    expect(stdout).toContain("const");
    expect(stdout).toContain("tx");
    expect(stdout).toContain("hash");
  });

  test("--help shows help with all commands", async () => {
    const { stdout, exitCode } = await runCli(["--help"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("chain");
    expect(stdout).toContain("account");
    expect(stdout).toContain("inspect");
    expect(stdout).toContain("query");
    expect(stdout).toContain("const");
    expect(stdout).toContain("tx");
    expect(stdout).toContain("hash");
  });

  test("--version shows semver", async () => {
    const { stdout, exitCode } = await runCli(["--version"]);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/\d+\.\d+\.\d+/);
  });

  test("--chain nonexistent errors", async () => {
    const { stderr, exitCode } = await runCli(["inspect", "--chain", "nonexistent"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Unknown chain");
  });

  test("hash with --output json produces valid JSON", async () => {
    const { stdout, exitCode } = await runCli(["hash", "sha256", "hello", "--output", "json"]);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed).toHaveProperty("algorithm");
    expect(parsed).toHaveProperty("hash");
  });
});
