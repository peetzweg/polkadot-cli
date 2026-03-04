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
    expect(stdout).toContain("chain: polkadot");
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
});
