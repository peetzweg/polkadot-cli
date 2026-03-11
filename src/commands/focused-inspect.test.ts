import { describe, expect, test } from "bun:test";
import { runCli } from "./__fixtures__/run-cli.ts";

describe("dot tx listing (calls)", () => {
  test("lists calls with arg signatures", async () => {
    const { stdout, exitCode } = await runCli(["tx.Balances"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Balances Calls");
    expect(stdout).toContain("transfer_allow_death");
    expect(stdout).toContain("dest:");
    expect(stdout).toContain("value:");
  });

  test("tx category-only lists pallets with calls", async () => {
    const { stdout, exitCode } = await runCli(["tx"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Pallets with calls");
    expect(stdout).toContain("System");
    expect(stdout).toContain("Balances");
  });

  test("typo suggests correct name", async () => {
    const { stderr, exitCode } = await runCli([
      "tx.Balances.transfer_alow_death",
      "0xaa",
      "--encode",
    ]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("transfer_allow_death");
  });

  test("chain prefix works", async () => {
    const config = {
      chains: { kusama: { rpc: "wss://kusama-rpc.polkadot.io" } },
    };
    const { stdout, exitCode } = await runCli(["kusama.tx.Balances"], { config });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Balances Calls");
  });
});

describe("dot events", () => {
  test("lists events with field signatures", async () => {
    const { stdout, exitCode } = await runCli(["events.Balances"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Balances Events");
    expect(stdout).toContain("Transfer");
    expect(stdout).toContain("from:");
    expect(stdout).toContain("to:");
  });

  test("shows event detail", async () => {
    const { stdout, exitCode } = await runCli(["events.Balances.Transfer"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("(Event)");
    expect(stdout).toContain("Fields:");
    expect(stdout).toContain("from:");
  });

  test("event alias works", async () => {
    const { stdout, exitCode } = await runCli(["event.Balances"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Balances Events");
  });

  test("typo suggests correct name", async () => {
    const { stderr, exitCode } = await runCli(["events.Balances.Transferr"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Transfer");
  });

  test("chain prefix works", async () => {
    const config = {
      chains: { kusama: { rpc: "wss://kusama-rpc.polkadot.io" } },
    };
    const { stdout, exitCode } = await runCli(["kusama.events.Balances"], { config });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Balances Events");
  });

  test("category-only lists pallets with events", async () => {
    const { stdout, exitCode } = await runCli(["events"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Pallets with events");
    expect(stdout).toContain("Balances");
  });

  test("events category-only shows multiple pallets", async () => {
    const { stdout, exitCode } = await runCli(["events"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("System");
    expect(stdout).toContain("Staking");
  });

  test("chain prefix works for events: kusama.events.Balances", async () => {
    const config = {
      chains: { kusama: { rpc: "wss://kusama-rpc.polkadot.io" } },
    };
    const { stdout, exitCode } = await runCli(["kusama.events.Balances"], { config });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Balances Events");
    expect(stdout).toContain("Transfer");
  });

  test("dot events.Balances.Transfer shows event detail", async () => {
    const { stdout, exitCode } = await runCli(["events.Balances.Transfer"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("(Event)");
    expect(stdout).toContain("Fields:");
    expect(stdout).toContain("from:");
    expect(stdout).toContain("to:");
    expect(stdout).toContain("amount:");
  });
});

describe("dot errors", () => {
  test("lists errors with docs", async () => {
    const { stdout, exitCode } = await runCli(["errors.Balances"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Balances Errors");
    expect(stdout).toContain("InsufficientBalance");
  });

  test("shows error detail", async () => {
    const { stdout, exitCode } = await runCli(["errors.Balances.InsufficientBalance"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("(Error)");
  });

  test("error alias works", async () => {
    const { stdout, exitCode } = await runCli(["error.Balances"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Balances Errors");
  });

  test("typo suggests correct name", async () => {
    const { stderr, exitCode } = await runCli(["errors.Balances.InsufficientBalanc"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("InsufficientBalance");
  });

  test("category-only lists pallets with errors", async () => {
    const { stdout, exitCode } = await runCli(["errors"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Pallets with errors");
    expect(stdout).toContain("Balances");
  });

  test("errors category-only shows multiple pallets", async () => {
    const { stdout, exitCode } = await runCli(["errors"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("System");
    expect(stdout).toContain("Staking");
  });

  test("chain prefix works for errors: kusama.errors.Balances", async () => {
    const config = {
      chains: { kusama: { rpc: "wss://kusama-rpc.polkadot.io" } },
    };
    const { stdout, exitCode } = await runCli(["kusama.errors.Balances"], { config });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Balances Errors");
    expect(stdout).toContain("InsufficientBalance");
  });

  test("dot errors.Balances.InsufficientBalance shows error detail", async () => {
    const { stdout, exitCode } = await runCli(["errors.Balances.InsufficientBalance"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("(Error)");
    // Should have docs about the error
    expect(stdout).toContain("Balance too low");
  });
});

describe("no truncation", () => {
  test("call docs show first complete sentence", async () => {
    const { stdout, exitCode } = await runCli(["tx.Balances"]);
    expect(exitCode).toBe(0);
    // force_transfer docs span multiple metadata lines — listing should show the full first sentence
    expect(stdout).toContain(
      "Exactly as `transfer_allow_death`, except the origin must be root and the source account may be specified.",
    );
  });

  test("event docs show complete sentence with e.g. abbreviation", async () => {
    const { stdout, exitCode } = await runCli(["events.Balances"]);
    expect(exitCode).toBe(0);
    // Deposit event doc contains "e.g." — should not be cut off at the abbreviation
    expect(stdout).toContain("Some amount was deposited (e.g. for transaction fees).");
    // Withdraw has same pattern
    expect(stdout).toContain(
      "Some amount was withdrawn from the account (e.g. for transaction fees).",
    );
  });

  test("error docs show complete first sentence", async () => {
    const { stdout, exitCode } = await runCli(["errors.Balances"]);
    expect(exitCode).toBe(0);
    // Error docs should show complete first sentences
    expect(stdout).toContain("Balance too low to send value.");
    expect(stdout).toContain("Vesting balance too high to send value.");
  });
});

describe("stdout/stderr separation (pipe-safe output)", () => {
  test("dot tx listing stdout has no progress messages", async () => {
    const { stdout, exitCode } = await runCli(["tx.Balances"]);
    expect(exitCode).toBe(0);
    expect(stdout).not.toContain("Fetching metadata");
    expect(stdout).not.toContain("Connecting");
  });

  test("dot events stdout has no progress messages", async () => {
    const { stdout, exitCode } = await runCli(["events.Balances"]);
    expect(exitCode).toBe(0);
    expect(stdout).not.toContain("Fetching metadata");
    expect(stdout).not.toContain("Connecting");
  });

  test("dot errors stdout has no progress messages", async () => {
    const { stdout, exitCode } = await runCli(["errors.Balances"]);
    expect(exitCode).toBe(0);
    expect(stdout).not.toContain("Fetching metadata");
    expect(stdout).not.toContain("Connecting");
  });
});
