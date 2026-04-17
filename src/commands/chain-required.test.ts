import { describe, expect, test } from "bun:test";
import { runCli } from "./__fixtures__/run-cli.ts";

// End-to-end tests for the "no default chain" contract:
// every chain-consuming command must have a chain source (flag or dotpath prefix).

// @ts-expect-error Bun supports describe(label, options, fn) at runtime
describe("chain is required (no default chain fallback)", { timeout: 15_000 }, () => {
  test("dot query.System.Number errors without --chain or prefix", async () => {
    const { stderr, exitCode } = await runCli(["query.System.Number"], { noDefaultChain: true });
    expect(exitCode).toBe(1);
    expect(stderr).toContain("No chain specified");
    expect(stderr).toContain("--chain");
    expect(stderr).toContain("polkadot");
  });

  test("dot tx.System.remark errors without --chain or prefix", async () => {
    const { stderr, exitCode } = await runCli(["tx.System.remark", "0xdead", "--from", "alice"], {
      noDefaultChain: true,
    });
    expect(exitCode).toBe(1);
    expect(stderr).toContain("No chain specified");
  });

  test("dot const.Balances.ExistentialDeposit errors without --chain or prefix", async () => {
    const { stderr, exitCode } = await runCli(["const.Balances.ExistentialDeposit"], {
      noDefaultChain: true,
    });
    expect(exitCode).toBe(1);
    expect(stderr).toContain("No chain specified");
  });

  test("dot events.Balances errors without --chain or prefix", async () => {
    const { stderr, exitCode } = await runCli(["events.Balances"], { noDefaultChain: true });
    expect(exitCode).toBe(1);
    expect(stderr).toContain("No chain specified");
  });

  test("dot errors.Balances errors without --chain or prefix", async () => {
    const { stderr, exitCode } = await runCli(["errors.Balances"], { noDefaultChain: true });
    expect(exitCode).toBe(1);
    expect(stderr).toContain("No chain specified");
  });

  test("dot apis.Core errors without --chain or prefix", async () => {
    const { stderr, exitCode } = await runCli(["apis.Core"], { noDefaultChain: true });
    expect(exitCode).toBe(1);
    expect(stderr).toContain("No chain specified");
  });

  test("dot inspect System errors without --chain or prefix", async () => {
    const { stderr, exitCode } = await runCli(["inspect", "System"], { noDefaultChain: true });
    expect(exitCode).toBe(1);
    expect(stderr).toContain("No chain specified");
  });

  test("error message lists available chains", async () => {
    const { stderr, exitCode } = await runCli(["query.System.Number"], { noDefaultChain: true });
    expect(exitCode).toBe(1);
    expect(stderr).toMatch(/Available chains:.*polkadot/);
    expect(stderr).toMatch(/Available chains:.*paseo/);
  });

  test("--chain flag satisfies the requirement", async () => {
    const { stdout, exitCode } = await runCli(
      ["const.Balances.ExistentialDeposit", "--chain", "polkadot"],
      { noDefaultChain: true },
    );
    expect(exitCode).toBe(0);
    expect(stdout).toBeDefined();
  });

  test("dotpath chain prefix satisfies the requirement", async () => {
    const { stdout, exitCode } = await runCli(["polkadot.const.Balances.ExistentialDeposit"], {
      noDefaultChain: true,
    });
    expect(exitCode).toBe(0);
    expect(stdout).toBeDefined();
  });

  test("both --chain and dotpath prefix at once errors", async () => {
    const { stderr, exitCode } = await runCli(
      ["polkadot.const.Balances.ExistentialDeposit", "--chain", "polkadot"],
      { noDefaultChain: true },
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Chain specified both as prefix");
  });

  test("cli help text advertises --chain as required", async () => {
    const { stdout, exitCode } = await runCli([]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("--chain");
    expect(stdout).toContain("required");
    expect(stdout).not.toContain("default from config");
  });

  test("chain list --json does not expose a default field", async () => {
    const { stdout, exitCode } = await runCli(["chain", "list", "--json"]);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    for (const chain of parsed.chains) {
      expect(chain.default).toBeUndefined();
    }
  });
});
