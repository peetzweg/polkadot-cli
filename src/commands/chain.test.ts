import { describe, expect, test } from "bun:test";
import { runCli } from "./__fixtures__/run-cli.ts";

describe("dot chain", () => {
  test("no action shows help", async () => {
    const { stdout, exitCode } = await runCli(["chain"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("dot chain add");
    expect(stdout).toContain("dot chain list");
  });

  test("chains shorthand shows help", async () => {
    const { stdout, exitCode } = await runCli(["chains"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("dot chain add");
  });

  test("unknown action foo errors", async () => {
    const { stderr, exitCode } = await runCli(["chain", "foo"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('Unknown action "foo"');
  });

  test("list shows all built-in chains", async () => {
    const { stdout, exitCode } = await runCli(["chain", "list"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("polkadot");
    expect(stdout).toContain("(default)");
    expect(stdout).toContain("rpc.polkadot.io");
    expect(stdout).toContain("paseo");
    expect(stdout).toContain("polkadot-asset-hub");
    expect(stdout).toContain("paseo-asset-hub");
    expect(stdout).toContain("polkadot-people");
  });

  test("list with multiple chains shows all", async () => {
    const { stdout, exitCode } = await runCli(["chain", "list"], {
      config: {
        chains: {
          kusama: { rpc: "wss://kusama-rpc.polkadot.io" },
          westend: { rpc: "wss://westend-rpc.polkadot.io" },
        },
      },
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("polkadot");
    expect(stdout).toContain("kusama");
    expect(stdout).toContain("westend");
  });

  test("list with light-client chain", async () => {
    const { stdout, exitCode } = await runCli(["chain", "list"], {
      config: {
        chains: {
          kusama: { rpc: "", lightClient: true },
        },
      },
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("kusama");
    expect(stdout).toContain("light-client");
  });

  test("default kusama succeeds", async () => {
    const { stdout, exitCode } = await runCli(["chain", "default", "kusama"], {
      config: {
        chains: {
          kusama: { rpc: "wss://kusama-rpc.polkadot.io" },
        },
      },
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Default chain set");
  });

  test("default (no name) errors", async () => {
    const { stderr, exitCode } = await runCli(["chain", "default"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Usage:");
  });

  test("default nonexistent errors", async () => {
    const { stderr, exitCode } = await runCli(["chain", "default", "nonexistent"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("not found");
    expect(stderr).toContain("Available");
  });

  test("remove kusama succeeds", async () => {
    const { stdout, exitCode } = await runCli(["chain", "remove", "kusama"], {
      config: {
        chains: {
          kusama: { rpc: "wss://kusama-rpc.polkadot.io" },
        },
      },
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("removed");
  });

  test("remove polkadot errors", async () => {
    const { stderr, exitCode } = await runCli(["chain", "remove", "polkadot"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Cannot remove");
  });

  test("remove paseo errors (built-in)", async () => {
    const { stderr, exitCode } = await runCli(["chain", "remove", "paseo"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('Cannot remove the built-in "paseo" chain');
  });

  test("remove polkadot-asset-hub errors (built-in)", async () => {
    const { stderr, exitCode } = await runCli(["chain", "remove", "polkadot-asset-hub"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('Cannot remove the built-in "polkadot-asset-hub" chain');
  });

  test("remove nonexistent errors", async () => {
    const { stderr, exitCode } = await runCli(["chain", "remove", "nonexistent"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("not found");
  });

  test("remove (no name) errors", async () => {
    const { stderr, exitCode } = await runCli(["chain", "remove"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Usage:");
  });

  test("remove default chain resets to polkadot", async () => {
    const { stdout, exitCode } = await runCli(["chain", "remove", "kusama"], {
      config: {
        defaultChain: "kusama",
        chains: {
          kusama: { rpc: "wss://kusama-rpc.polkadot.io" },
        },
      },
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Default chain reset to "polkadot"');
  });

  test("add (no name) errors", async () => {
    const { stderr, exitCode } = await runCli(["chain", "add"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Chain name is required");
  });

  test("add mychain (no --rpc) errors", async () => {
    const { stderr, exitCode } = await runCli(["chain", "add", "mychain"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Must provide either --rpc");
  });

  test("remove Polkadot (case-insensitive) errors as built-in", async () => {
    const { stderr, exitCode } = await runCli(["chain", "remove", "Polkadot"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Cannot remove");
  });

  test("default Polkadot (case-insensitive) succeeds", async () => {
    const { stdout, exitCode } = await runCli(["chain", "default", "Polkadot"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Default chain set to "polkadot"');
  });

  test("default POLKADOT (all-caps) succeeds", async () => {
    const { stdout, exitCode } = await runCli(["chain", "default", "POLKADOT"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Default chain set to "polkadot"');
  });
});
