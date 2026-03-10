import { describe, expect, test } from "bun:test";
import { runCli } from "./__fixtures__/run-cli.ts";

describe("dot const", () => {
  test("no target shows help", async () => {
    const { stdout, exitCode } = await runCli(["const"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Usage: dot const");
  });

  test("chain prefix works (3-segment)", async () => {
    const { stdout, exitCode } = await runCli(["const", "polkadot.System.SS58Prefix"]);
    expect(exitCode).toBe(0);
    expect(stdout).toBeTruthy();
  });

  test("stdout does not contain chain info prefix", async () => {
    const { stdout, exitCode } = await runCli(["const", "polkadot.System.SS58Prefix"]);
    expect(exitCode).toBe(0);
    expect(stdout).not.toContain("chain:");
    expect(stdout).not.toContain("chain: polkadot");
  });

  test("json output is valid JSON with no extra text", async () => {
    const { stdout, exitCode } = await runCli([
      "const",
      "polkadot.System.SS58Prefix",
      "--output",
      "json",
    ]);
    expect(exitCode).toBe(0);
    expect(() => JSON.parse(stdout)).not.toThrow();
  });

  test("chain prefix + --chain flag errors", async () => {
    const { stderr, exitCode } = await runCli([
      "const",
      "polkadot.System.SS58Prefix",
      "--chain",
      "polkadot",
    ]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Chain specified both as prefix");
  });

  test("case-insensitive chain prefix resolves correctly", async () => {
    const { stdout, exitCode } = await runCli(["const", "Polkadot.System.SS58Prefix"]);
    expect(exitCode).toBe(0);
    expect(stdout).toBeTruthy();
  });

  test("case-insensitive --chain flag resolves correctly", async () => {
    const { stdout, exitCode } = await runCli([
      "const",
      "System.SS58Prefix",
      "--chain",
      "POLKADOT",
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toBeTruthy();
  });

  test("json output has no progress messages on stdout", async () => {
    const { stdout, exitCode } = await runCli(["const", "System.SS58Prefix", "--output", "json"]);
    expect(exitCode).toBe(0);
    // stdout should be pure JSON — no "Fetching metadata" or spinner text
    expect(stdout).not.toContain("Fetching metadata");
    expect(stdout).not.toContain("Connecting");
    expect(() => JSON.parse(stdout)).not.toThrow();
  });
});
