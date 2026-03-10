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

  test("inspect System lists pallet items with types", async () => {
    const { stdout, exitCode } = await runCli(["inspect", "System"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Storage Items:");
    expect(stdout).toContain("Account");
    expect(stdout).toContain("[map]");
    expect(stdout).toContain("Constants:");
    expect(stdout).toContain("SS58Prefix");
    // Constants should show type info
    expect(stdout).toContain("SS58Prefix");
    expect(stdout).toContain("u16");
  });

  test("inspect system (lowercase) works", async () => {
    const { stdout, exitCode } = await runCli(["inspect", "system"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("System Pallet");
    expect(stdout).toContain("Storage Items:");
  });

  test("inspect Balances lists items with types", async () => {
    const { stdout, exitCode } = await runCli(["inspect", "Balances"]);
    expect(exitCode).toBe(0);
    // Constants show type
    expect(stdout).toContain("ExistentialDeposit");
    expect(stdout).toContain("u128");
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

  test("call listing shows call names with args", async () => {
    const { stdout, exitCode } = await runCli(["inspect", "Balances"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("transfer_allow_death");
    // Calls should show argument signatures
    expect(stdout).toContain("dest:");
    expect(stdout).toContain("value:");
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

  test("storage listing shows map tag for map items", async () => {
    const { stdout, exitCode } = await runCli(["inspect", "System"]);
    expect(exitCode).toBe(0);
    // Account is a map storage item — should show [map] tag and arrow
    expect(stdout).toContain("Account");
    expect(stdout).toContain("[map]");
    expect(stdout).toContain("→");
  });

  test("storage listing shows plain type without map tag", async () => {
    const { stdout, exitCode } = await runCli(["inspect", "System"]);
    expect(exitCode).toBe(0);
    // Number is a plain storage item — should show type but not [map]
    expect(stdout).toContain("Number");
    expect(stdout).toContain("u32");
    // Number line specifically should not have [map] — check via lines
    const lines = stdout.split("\n");
    const numberLine = lines.find((l: string) => l.includes("Number") && !l.includes("Block"));
    expect(numberLine).toBeDefined();
    expect(numberLine).not.toContain("[map]");
  });

  test("constants listing shows type info", async () => {
    const { stdout, exitCode } = await runCli(["inspect", "System"]);
    expect(exitCode).toBe(0);
    const lines = stdout.split("\n");
    const ss58Line = lines.find((l: string) => l.includes("SS58Prefix"));
    expect(ss58Line).toContain("u16");
  });

  test("calls listing shows argument signatures", async () => {
    const { stdout, exitCode } = await runCli(["inspect", "System"]);
    expect(exitCode).toBe(0);
    // System.remark takes a remark: Vec<u8> argument
    expect(stdout).toContain("remark");
    expect(stdout).toContain("Vec<u8>");
  });

  test("call detail shows documentation", async () => {
    const { stdout, exitCode } = await runCli(["inspect", "Balances.transfer_allow_death"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("(Call)");
    // Should contain actual doc text from metadata, not be empty
    expect(stdout).toContain("Transfer some liquid free balance");
  });

  test("call listing shows doc on indented second line", async () => {
    const { stdout, exitCode } = await runCli(["inspect", "Balances"]);
    expect(exitCode).toBe(0);
    const lines = stdout.split("\n");
    // Find the transfer_allow_death call line, next line should be indented doc
    const callIdx = lines.findIndex((l: string) => l.includes("transfer_allow_death"));
    expect(callIdx).toBeGreaterThan(-1);
    const docLine = lines[callIdx + 1];
    expect(docLine).toMatch(/^\s{8}/); // 8-space indent for doc line
    expect(docLine).toContain("Transfer some liquid free balance");
  });

  test("docs appear on indented second line", async () => {
    const { stdout, exitCode } = await runCli(["inspect", "Balances"]);
    expect(exitCode).toBe(0);
    const lines = stdout.split("\n");
    // Find ExistentialDeposit line (has type), next line should be indented doc
    const edIdx = lines.findIndex(
      (l: string) => l.includes("ExistentialDeposit") && l.includes("u128"),
    );
    expect(edIdx).toBeGreaterThan(-1);
    const docLine = lines[edIdx + 1];
    expect(docLine).toMatch(/^\s{8}/); // 8-space indent for doc line
    expect(docLine).toContain("minimum amount");
  });

  // --- Events & Errors ---

  test("overview shows events and errors counts", async () => {
    const { stdout, exitCode } = await runCli(["inspect"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("events");
    expect(stdout).toContain("errors");
  });

  test("pallet listing shows Events section", async () => {
    const { stdout, exitCode } = await runCli(["inspect", "Balances"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Events:");
  });

  test("pallet listing shows Errors section", async () => {
    const { stdout, exitCode } = await runCli(["inspect", "Balances"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Errors:");
  });

  test("event listing shows names with field signatures", async () => {
    const { stdout, exitCode } = await runCli(["inspect", "Balances"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Transfer");
    // Transfer event should show field signature
    expect(stdout).toContain("from:");
    expect(stdout).toContain("to:");
    expect(stdout).toContain("amount:");
  });

  test("error listing shows names with docs", async () => {
    const { stdout, exitCode } = await runCli(["inspect", "Balances"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("InsufficientBalance");
  });

  test("event detail view", async () => {
    const { stdout, exitCode } = await runCli(["inspect", "Balances.Transfer"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("(Event)");
    expect(stdout).toContain("Fields:");
    expect(stdout).toContain("from:");
    expect(stdout).toContain("to:");
    expect(stdout).toContain("amount:");
  });

  test("error detail view", async () => {
    const { stdout, exitCode } = await runCli(["inspect", "Balances.InsufficientBalance"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("(Error)");
  });

  test("event doc indentation", async () => {
    const { stdout, exitCode } = await runCli(["inspect", "Balances"]);
    expect(exitCode).toBe(0);
    const lines = stdout.split("\n");
    const transferIdx = lines.findIndex(
      (l: string) => l.includes("Transfer") && l.includes("from:"),
    );
    expect(transferIdx).toBeGreaterThan(-1);
    const docLine = lines[transferIdx + 1];
    expect(docLine).toMatch(/^\s{8}/); // 8-space indent for doc line
  });

  test("error doc indentation", async () => {
    const { stdout, exitCode } = await runCli(["inspect", "Balances"]);
    expect(exitCode).toBe(0);
    const lines = stdout.split("\n");
    const errIdx = lines.findIndex((l: string) => l.includes("InsufficientBalance"));
    expect(errIdx).toBeGreaterThan(-1);
    const docLine = lines[errIdx + 1];
    expect(docLine).toMatch(/^\s{8}/); // 8-space indent for doc line
  });

  test("event typo suggests correct name", async () => {
    const { stderr, exitCode } = await runCli(["inspect", "Balances.Transferr"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Transfer");
  });

  test("error typo suggests correct name", async () => {
    const { stderr, exitCode } = await runCli(["inspect", "Balances.InsufficientBalanc"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("InsufficientBalance");
  });
});
