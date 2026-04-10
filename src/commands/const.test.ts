import { describe, expect, test } from "bun:test";
import { runCli } from "./__fixtures__/run-cli.ts";

// @ts-expect-error Bun supports describe(label, options, fn) at runtime
describe("dot const", { timeout: 15_000 }, () => {
  test("category-only lists pallets with constants", async () => {
    const { stdout, exitCode } = await runCli(["const"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Pallets with constants");
    expect(stdout).toContain("System");
  });

  test("chain prefix works (4-segment)", async () => {
    const { stdout, exitCode } = await runCli(["polkadot.const.System.SS58Prefix"]);
    expect(exitCode).toBe(0);
    expect(stdout).toBeTruthy();
  }, 15_000);

  test("stdout does not contain chain info prefix", async () => {
    const { stdout, exitCode } = await runCli(["polkadot.const.System.SS58Prefix"]);
    expect(exitCode).toBe(0);
    expect(stdout).not.toContain("chain:");
    expect(stdout).not.toContain("chain: polkadot");
  }, 15_000);

  test("json output is valid JSON with no extra text", async () => {
    const { stdout, exitCode } = await runCli([
      "polkadot.const.System.SS58Prefix",
      "--output",
      "json",
    ]);
    expect(exitCode).toBe(0);
    expect(() => JSON.parse(stdout)).not.toThrow();
  }, 15_000);

  test("chain prefix + --chain flag errors", async () => {
    const { stderr, exitCode } = await runCli([
      "polkadot.const.System.SS58Prefix",
      "--chain",
      "polkadot",
    ]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Chain specified both as prefix");
  }, 15_000);

  test("case-insensitive chain prefix resolves correctly", async () => {
    const { stdout, exitCode } = await runCli(["Polkadot.const.System.SS58Prefix"]);
    expect(exitCode).toBe(0);
    expect(stdout).toBeTruthy();
  }, 15_000);

  test("case-insensitive --chain flag resolves correctly", async () => {
    const { stdout, exitCode } = await runCli(["const.System.SS58Prefix", "--chain", "POLKADOT"]);
    expect(exitCode).toBe(0);
    expect(stdout).toBeTruthy();
  }, 15_000);

  test("listing shows first complete sentence from docs", async () => {
    const { stdout, exitCode } = await runCli(["const.Balances"]);
    expect(exitCode).toBe(0);
    // firstSentence extracts only the first sentence, not the full doc line
    expect(stdout).toContain("The minimum amount required to keep an account open.");
    // Multiple constants should each show their first sentence
    expect(stdout).toContain("The maximum number of locks that should exist on an account.");
  });

  test("json output has no progress messages on stdout", async () => {
    const { stdout, exitCode } = await runCli(["const.System.SS58Prefix", "--output", "json"]);
    expect(exitCode).toBe(0);
    // stdout should be pure JSON — no "Fetching metadata" or spinner text
    expect(stdout).not.toContain("Fetching metadata");
    expect(stdout).not.toContain("Connecting");
    expect(() => JSON.parse(stdout)).not.toThrow();
  });

  test("consts alias works", async () => {
    const { stdout, exitCode } = await runCli(["consts.Balances"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Balances Constants");
  });

  test("constants alias works", async () => {
    const { stdout, exitCode } = await runCli(["constants.Balances"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Balances Constants");
  });

  test("lists constants when pallet only", async () => {
    const { stdout, exitCode } = await runCli(["const.Balances"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Balances Constants");
    expect(stdout).toContain("ExistentialDeposit");
  });

  test("dot const shows pallet list (category-only mode)", async () => {
    const { stdout, exitCode } = await runCli(["const"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Pallets with constants");
    expect(stdout).toContain("Balances");
    expect(stdout).toContain("Staking");
  });

  test("dot const.System lists constants in System", async () => {
    const { stdout, exitCode } = await runCli(["const.System"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("System Constants");
    expect(stdout).toContain("SS58Prefix");
    expect(stdout).toContain("BlockWeights");
  });

  test("const.Balances.ExistentialDeposit --help shows constant help", async () => {
    const { stdout, exitCode } = await runCli(["const.Balances.ExistentialDeposit", "--help"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("(Constant)");
    expect(stdout).toContain("Type:");
    expect(stdout).toContain("Usage:");
  });

  test("unknown pallet in const listing suggests alternatives", async () => {
    const { stderr, exitCode } = await runCli(["const.Systm"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("System");
  });

  // --json output tests
  test("const --json lists pallets with constant counts", async () => {
    const { stdout, exitCode } = await runCli(["const", "--json"]);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.chain).toBe("polkadot");
    expect(Array.isArray(parsed.pallets)).toBe(true);
    const system = parsed.pallets.find((p: any) => p.name === "System");
    expect(system).toBeDefined();
    expect(system.constants).toBeGreaterThan(0);
  });

  test("const.System --json lists constants in pallet", async () => {
    const { stdout, exitCode } = await runCli(["const.System", "--json"]);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.pallet).toBe("System");
    expect(Array.isArray(parsed.constants)).toBe(true);
    const ss58 = parsed.constants.find((c: any) => c.name === "SS58Prefix");
    expect(ss58).toBeDefined();
    expect(ss58.type).toBeDefined();
  });
});
