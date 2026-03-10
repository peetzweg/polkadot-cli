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

  test("case-insensitive chain prefix resolves correctly", async () => {
    const { stdout, exitCode } = await runCli(["inspect", "Polkadot.System"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("System Pallet");
  });

  test("case-insensitive --chain flag resolves correctly", async () => {
    const { stdout, exitCode } = await runCli(["inspect", "System", "--chain", "POLKADOT"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("System Pallet");
  });

  test("no-target view shows calls count", async () => {
    const { stdout, exitCode } = await runCli(["inspect"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("calls");
  });

  test("pallet overview shows Calls section", async () => {
    const { stdout, exitCode } = await runCli(["inspect", "Balances"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Calls:");
  });

  test("call listing shows call names", async () => {
    const { stdout, exitCode } = await runCli(["inspect", "Balances"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("transfer_allow_death");
  });

  test("call detail view", async () => {
    const { stdout, exitCode } = await runCli(["inspect", "Balances.transfer_allow_death"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("(Call)");
    expect(stdout).toContain("Args:");
  });

  test("void call detail", async () => {
    const { stdout, exitCode } = await runCli(["inspect", "System.remark"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("(Call)");
    expect(stdout).toContain("Args:");
  });

  test("call typo suggests correct name", async () => {
    const { stderr, exitCode } = await runCli(["inspect", "Balances.transfer_alow_death"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("transfer_allow_death");
  });
});
