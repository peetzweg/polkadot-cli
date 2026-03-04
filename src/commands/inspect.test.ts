import { describe, expect, test } from "bun:test";
import { runCli } from "./__fixtures__/run-cli.ts";

describe("dot inspect", () => {
  test("no target lists all pallets", async () => {
    const { stdout, exitCode } = await runCli(["inspect"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("System");
    expect(stdout).toContain("Balances");
    expect(stdout).toContain("Pallets on polkadot");
  });

  test("inspect System lists pallet items", async () => {
    const { stdout, exitCode } = await runCli(["inspect", "System"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Storage Items:");
    expect(stdout).toContain("Account");
    expect(stdout).toContain("Constants:");
    expect(stdout).toContain("SS58Prefix");
  });

  test("inspect system (lowercase) works", async () => {
    const { stdout, exitCode } = await runCli(["inspect", "system"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("System Pallet");
    expect(stdout).toContain("Storage Items:");
  });

  test("inspect Balances lists items", async () => {
    const { stdout, exitCode } = await runCli(["inspect", "Balances"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("ExistentialDeposit");
  });

  test("inspect System.Account shows storage detail", async () => {
    const { stdout, exitCode } = await runCli(["inspect", "System.Account"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("(Storage)");
    expect(stdout).toContain("Type:");
    expect(stdout).toContain("map");
    expect(stdout).toContain("Value:");
    expect(stdout).toContain("Key:");
  });

  test("inspect System.SS58Prefix shows constant detail", async () => {
    const { stdout, exitCode } = await runCli(["inspect", "System.SS58Prefix"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("(Constant)");
    expect(stdout).toContain("Type:");
  });

  test("inspect Balances.ExistentialDeposit shows constant detail", async () => {
    const { stdout, exitCode } = await runCli(["inspect", "Balances.ExistentialDeposit"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("(Constant)");
  });

  test("inspect Systm (typo) suggests System", async () => {
    const { stderr, exitCode } = await runCli(["inspect", "Systm"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("System");
    expect(stderr).toContain("Did you mean");
  });

  test("inspect System.Accont (typo) suggests Account", async () => {
    const { stderr, exitCode } = await runCli(["inspect", "System.Accont"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Account");
  });

  test("inspect System.FooBarBaz errors", async () => {
    const { exitCode } = await runCli(["inspect", "System.FooBarBaz"]);
    expect(exitCode).toBe(1);
  });

  test("chain prefix lists pallet items", async () => {
    const config = {
      chains: { kusama: { rpc: "wss://kusama-rpc.polkadot.io" } },
    };
    const { stdout, exitCode } = await runCli(["inspect", "kusama.System"], { config });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("System Pallet");
    expect(stdout).toContain("Storage Items:");
  });

  test("chain prefix with item shows detail", async () => {
    const config = {
      chains: { kusama: { rpc: "wss://kusama-rpc.polkadot.io" } },
    };
    const { stdout, exitCode } = await runCli(["inspect", "kusama.System.Account"], { config });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("(Storage)");
  });

  test("chain prefix + --chain flag errors", async () => {
    const config = {
      chains: { kusama: { rpc: "wss://kusama-rpc.polkadot.io" } },
    };
    const { stderr, exitCode } = await runCli(["inspect", "kusama.System", "--chain", "polkadot"], {
      config,
    });
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Chain specified both as prefix");
  });
});
