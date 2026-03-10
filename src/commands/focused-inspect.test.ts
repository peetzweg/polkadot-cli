import { describe, expect, test } from "bun:test";
import { runCli } from "./__fixtures__/run-cli.ts";

describe("dot calls", () => {
  test("lists calls with arg signatures", async () => {
    const { stdout, exitCode } = await runCli(["calls", "Balances"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Balances Calls");
    expect(stdout).toContain("transfer_allow_death");
    expect(stdout).toContain("dest:");
    expect(stdout).toContain("value:");
  });

  test("shows call detail", async () => {
    const { stdout, exitCode } = await runCli(["calls", "Balances.transfer_allow_death"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("(Call)");
    expect(stdout).toContain("Args:");
  });

  test("singular alias works", async () => {
    const { stdout, exitCode } = await runCli(["call", "Balances"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Balances Calls");
  });

  test("typo suggests correct name", async () => {
    const { stderr, exitCode } = await runCli(["calls", "Balances.transfer_alow_death"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("transfer_allow_death");
  });

  test("chain prefix works", async () => {
    const config = {
      chains: { kusama: { rpc: "wss://kusama-rpc.polkadot.io" } },
    };
    const { stdout, exitCode } = await runCli(["calls", "kusama.Balances"], { config });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Balances Calls");
  });

  test("no target shows usage", async () => {
    const { stdout, exitCode } = await runCli(["calls"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Usage:");
  });
});

describe("dot events", () => {
  test("lists events with field signatures", async () => {
    const { stdout, exitCode } = await runCli(["events", "Balances"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Balances Events");
    expect(stdout).toContain("Transfer");
    expect(stdout).toContain("from:");
    expect(stdout).toContain("to:");
  });

  test("shows event detail", async () => {
    const { stdout, exitCode } = await runCli(["events", "Balances.Transfer"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("(Event)");
    expect(stdout).toContain("Fields:");
    expect(stdout).toContain("from:");
  });

  test("singular alias works", async () => {
    const { stdout, exitCode } = await runCli(["event", "Balances"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Balances Events");
  });

  test("typo suggests correct name", async () => {
    const { stderr, exitCode } = await runCli(["events", "Balances.Transferr"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Transfer");
  });

  test("chain prefix works", async () => {
    const config = {
      chains: { kusama: { rpc: "wss://kusama-rpc.polkadot.io" } },
    };
    const { stdout, exitCode } = await runCli(["events", "kusama.Balances"], { config });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Balances Events");
  });

  test("no target shows usage", async () => {
    const { stdout, exitCode } = await runCli(["events"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Usage:");
  });
});

describe("dot errors", () => {
  test("lists errors with docs", async () => {
    const { stdout, exitCode } = await runCli(["errors", "Balances"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Balances Errors");
    expect(stdout).toContain("InsufficientBalance");
  });

  test("shows error detail", async () => {
    const { stdout, exitCode } = await runCli(["errors", "Balances.InsufficientBalance"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("(Error)");
  });

  test("singular alias works", async () => {
    const { stdout, exitCode } = await runCli(["error", "Balances"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Balances Errors");
  });

  test("typo suggests correct name", async () => {
    const { stderr, exitCode } = await runCli(["errors", "Balances.InsufficientBalanc"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("InsufficientBalance");
  });

  test("no target shows usage", async () => {
    const { stdout, exitCode } = await runCli(["errors"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Usage:");
  });
});

describe("dot storage", () => {
  test("lists storage items with types", async () => {
    const { stdout, exitCode } = await runCli(["storage", "System"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("System Storage");
    expect(stdout).toContain("Account");
    expect(stdout).toContain("[map]");
  });

  test("shows storage detail", async () => {
    const { stdout, exitCode } = await runCli(["storage", "System.Account"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("(Storage)");
    expect(stdout).toContain("Type:");
    expect(stdout).toContain("map");
    expect(stdout).toContain("Value:");
    expect(stdout).toContain("Key:");
  });

  test("typo suggests correct name", async () => {
    const { stderr, exitCode } = await runCli(["storage", "System.Accont"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Account");
  });

  test("no target shows usage", async () => {
    const { stdout, exitCode } = await runCli(["storage"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Usage:");
  });
});

describe("dot pallets", () => {
  test("lists all pallets with counts", async () => {
    const { stdout, exitCode } = await runCli(["pallets"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("System");
    expect(stdout).toContain("Balances");
    expect(stdout).toContain("storage");
    expect(stdout).toContain("calls");
    expect(stdout).toContain("events");
    expect(stdout).toContain("errors");
  });

  test("singular alias works", async () => {
    const { stdout, exitCode } = await runCli(["pallet"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("System");
    expect(stdout).toContain("Balances");
  });

  test("specific pallet shows summary", async () => {
    const { stdout, exitCode } = await runCli(["pallets", "Balances"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Balances Pallet");
  });

  test("pallet typo suggests correct name", async () => {
    const { stderr, exitCode } = await runCli(["pallets", "Balancess"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Balances");
  });
});

describe("no truncation", () => {
  test("call docs show first complete sentence", async () => {
    const { stdout, exitCode } = await runCli(["calls", "Balances"]);
    expect(exitCode).toBe(0);
    // force_transfer docs span multiple metadata lines — listing should show the full first sentence
    expect(stdout).toContain(
      "Exactly as `transfer_allow_death`, except the origin must be root and the source account may be specified.",
    );
  });

  test("event docs show complete sentence with e.g. abbreviation", async () => {
    const { stdout, exitCode } = await runCli(["events", "Balances"]);
    expect(exitCode).toBe(0);
    // Deposit event doc contains "e.g." — should not be cut off at the abbreviation
    expect(stdout).toContain("Some amount was deposited (e.g. for transaction fees).");
    // Withdraw has same pattern
    expect(stdout).toContain(
      "Some amount was withdrawn from the account (e.g. for transaction fees).",
    );
  });

  test("storage type strings are not truncated at 60 chars", async () => {
    const { stdout, exitCode } = await runCli(["storage", "System"]);
    expect(exitCode).toBe(0);
    // Account value type contains "sufficients: u32, data:" which is past the 60-char mark
    expect(stdout).toContain("sufficients: u32, data:");
    const lines = stdout.split("\n");
    const accountLine = lines.find((l: string) => l.includes("Account") && l.includes("[map]"));
    expect(accountLine).toBeDefined();
    expect(accountLine).not.toMatch(/\.\.\./);
  });

  test("error docs show complete first sentence", async () => {
    const { stdout, exitCode } = await runCli(["errors", "Balances"]);
    expect(exitCode).toBe(0);
    // Error docs should show complete first sentences
    expect(stdout).toContain("Balance too low to send value.");
    expect(stdout).toContain("Vesting balance too high to send value.");
  });
});

describe("stdout/stderr separation (pipe-safe output)", () => {
  test("dot calls stdout has no progress messages", async () => {
    const { stdout, exitCode } = await runCli(["calls", "Balances"]);
    expect(exitCode).toBe(0);
    expect(stdout).not.toContain("Fetching metadata");
    expect(stdout).not.toContain("Connecting");
  });

  test("dot events stdout has no progress messages", async () => {
    const { stdout, exitCode } = await runCli(["events", "Balances"]);
    expect(exitCode).toBe(0);
    expect(stdout).not.toContain("Fetching metadata");
    expect(stdout).not.toContain("Connecting");
  });

  test("dot errors stdout has no progress messages", async () => {
    const { stdout, exitCode } = await runCli(["errors", "Balances"]);
    expect(exitCode).toBe(0);
    expect(stdout).not.toContain("Fetching metadata");
    expect(stdout).not.toContain("Connecting");
  });

  test("dot storage stdout has no progress messages", async () => {
    const { stdout, exitCode } = await runCli(["storage", "System"]);
    expect(exitCode).toBe(0);
    expect(stdout).not.toContain("Fetching metadata");
    expect(stdout).not.toContain("Connecting");
  });

  test("dot pallets stdout has no progress messages", async () => {
    const { stdout, exitCode } = await runCli(["pallets"]);
    expect(exitCode).toBe(0);
    expect(stdout).not.toContain("Fetching metadata");
    expect(stdout).not.toContain("Connecting");
  });
});

describe("dot const (dual-purpose)", () => {
  test("lists constants when pallet only", async () => {
    const { stdout, exitCode } = await runCli(["const", "Balances"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Balances Constants");
    expect(stdout).toContain("ExistentialDeposit");
  });

  test("consts alias works", async () => {
    const { stdout, exitCode } = await runCli(["consts", "Balances"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Balances Constants");
  });

  test("constants alias works", async () => {
    const { stdout, exitCode } = await runCli(["constants", "Balances"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Balances Constants");
  });
});
