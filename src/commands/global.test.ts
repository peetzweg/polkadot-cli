import { describe, expect, test } from "bun:test";
import { runCli } from "./__fixtures__/run-cli.ts";

describe("global CLI", () => {
  test("no command shows help", async () => {
    const { stdout, exitCode } = await runCli([]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("inspect");
    expect(stdout).toContain("chain");
    expect(stdout).toContain("account");
    expect(stdout).toContain("hash");
    expect(stdout).toContain("query");
    expect(stdout).toContain("const");
    expect(stdout).toContain("tx");
    expect(stdout).toContain("events");
    expect(stdout).toContain("errors");
  });

  test("--help shows help with all categories and commands", async () => {
    const { stdout, exitCode } = await runCli(["--help"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("inspect");
    expect(stdout).toContain("chain");
    expect(stdout).toContain("account");
    expect(stdout).toContain("hash");
    expect(stdout).toContain("query");
    expect(stdout).toContain("const");
    expect(stdout).toContain("tx");
    expect(stdout).toContain("events");
    expect(stdout).toContain("errors");
  });

  test("--help and no args show the same global help", async () => {
    const bare = await runCli([]);
    const help = await runCli(["--help"]);
    expect(help.exitCode).toBe(0);
    expect(help.stdout).toBe(bare.stdout);
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

  test("unknown dot-path shows error: dot foobar", async () => {
    const { stderr, exitCode } = await runCli(["foobar"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Unknown command");
  });

  test("explore alias works as command", async () => {
    const { stdout, exitCode } = await runCli(["explore"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("System");
    expect(stdout).toContain("Balances");
    expect(stdout).toContain("Pallets on polkadot");
  });

  test("explore alias appears in help output", async () => {
    const { stdout, exitCode } = await runCli(["--help"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("explore");
  });

  test("unknown dot-path with chain prefix errors", async () => {
    const { stderr, exitCode } = await runCli(["polkadot.foobar"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Unknown command");
  });
});
