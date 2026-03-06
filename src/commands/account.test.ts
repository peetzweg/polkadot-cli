import { describe, expect, test } from "bun:test";
import type { StoredAccount } from "../config/accounts-types.ts";
import { runCli, TEST_MNEMONIC } from "./__fixtures__/run-cli.ts";

const STORED_ACCOUNT: StoredAccount = {
  name: "my-account",
  secret: TEST_MNEMONIC,
  publicKey: "0x44a996beb1eef7bdcab976ab6d2ca26104834164ecf28fb375600576fcc6eb0f",
  derivationPath: "",
};

describe("dot account", () => {
  test("no action shows help", async () => {
    const { stdout, exitCode } = await runCli(["account"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("dot account create");
    expect(stdout).toContain("dot account list");
  });

  test("accounts shorthand shows help", async () => {
    const { stdout, exitCode } = await runCli(["accounts"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("dot account create");
  });

  test("unknown action foo errors", async () => {
    const { stderr, exitCode } = await runCli(["account", "foo"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('Unknown action "foo"');
  });

  test("create my-test succeeds", async () => {
    const { stdout, exitCode } = await runCli(["account", "create", "my-test"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Account Created");
    expect(stdout).toContain("Mnemonic:");
    expect(stdout).toContain("Address:");
  });

  test("create (no name) errors", async () => {
    const { stderr, exitCode } = await runCli(["account", "create"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("name is required");
  });

  test("create alice (dev name) errors", async () => {
    const { stderr, exitCode } = await runCli(["account", "create", "alice"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("built-in dev account");
  });

  test("create existing (duplicate) errors", async () => {
    const { stderr, exitCode } = await runCli(["account", "create", "my-account"], {
      accounts: [STORED_ACCOUNT],
    });
    expect(exitCode).toBe(1);
    expect(stderr).toContain("already exists");
  });

  test("import name --secret <mnemonic> succeeds", async () => {
    const { stdout, exitCode } = await runCli([
      "account",
      "import",
      "my-imported",
      "--secret",
      TEST_MNEMONIC,
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Account Imported");
    expect(stdout).toContain("Address:");
  });

  test("import with invalid secret errors", async () => {
    const { stderr, exitCode } = await runCli([
      "account",
      "import",
      "bad-key",
      "--secret",
      "not a valid mnemonic at all",
    ]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Invalid secret");
  });

  test("import (no name) errors", async () => {
    const { stderr, exitCode } = await runCli(["account", "import"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("name is required");
  });

  test("import name (no --secret) errors", async () => {
    const { stderr, exitCode } = await runCli(["account", "import", "my-key"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("--secret is required");
  });

  test("import bob (dev name) errors", async () => {
    const { stderr, exitCode } = await runCli([
      "account",
      "import",
      "bob",
      "--secret",
      TEST_MNEMONIC,
    ]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("built-in dev account");
  });

  test("list shows dev accounts", async () => {
    const { stdout, exitCode } = await runCli(["account", "list"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Dev Accounts");
    expect(stdout).toContain("Alice");
    expect(stdout).toContain("Bob");
  });

  test("list with stored accounts shows both sections", async () => {
    const { stdout, exitCode } = await runCli(["account", "list"], {
      accounts: [STORED_ACCOUNT],
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Dev Accounts");
    expect(stdout).toContain("Stored Accounts");
    expect(stdout).toContain("my-account");
  });

  test("list with no stored shows (none)", async () => {
    const { stdout, exitCode } = await runCli(["account", "list"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("(none)");
  });

  test("remove name succeeds", async () => {
    const { stdout, exitCode } = await runCli(["account", "remove", "my-account"], {
      accounts: [STORED_ACCOUNT],
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("removed");
  });

  test("remove (no name) errors", async () => {
    const { stderr, exitCode } = await runCli(["account", "remove"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("name is required");
  });

  test("remove alice (dev account) errors", async () => {
    const { stderr, exitCode } = await runCli(["account", "remove", "alice"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Cannot remove built-in");
  });

  test("remove ghost (not found) errors", async () => {
    const { stderr, exitCode } = await runCli(["account", "remove", "ghost"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("not found");
  });

  test("add name --env VAR (env set) succeeds with address", async () => {
    const { stdout, exitCode } = await runCli(
      ["account", "add", "env-test", "--env", "MY_SECRET"],
      {
        env: { MY_SECRET: TEST_MNEMONIC },
      },
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Account Added");
    expect(stdout).toContain("Address:");
  });

  test("add name --env VAR (env not set) succeeds with deferred", async () => {
    const { stdout, exitCode } = await runCli(
      ["account", "add", "env-test", "--env", "MY_SECRET"],
      { env: { MY_SECRET: "" } },
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Account Added");
    expect(stdout).toContain("will resolve");
  });

  test("add (no name) errors", async () => {
    const { stderr, exitCode } = await runCli(["account", "add"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("name is required");
  });

  test("add name (no --env) errors", async () => {
    const { stderr, exitCode } = await runCli(["account", "add", "env-test"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("--env is required");
  });

  test("add alice --env VAR (dev name) errors", async () => {
    const { stderr, exitCode } = await runCli(["account", "add", "alice", "--env", "MY_SECRET"], {
      env: { MY_SECRET: TEST_MNEMONIC },
    });
    expect(exitCode).toBe(1);
    expect(stderr).toContain("built-in dev account");
  });

  test("add duplicate --env VAR errors", async () => {
    const { stderr, exitCode } = await runCli(
      ["account", "add", "my-account", "--env", "MY_SECRET"],
      {
        accounts: [STORED_ACCOUNT],
        env: { MY_SECRET: TEST_MNEMONIC },
      },
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain("already exists");
  });

  test("list with env-backed account shows env badge", async () => {
    const envAccount: StoredAccount = {
      name: "env-acct",
      secret: { env: "MY_SECRET" },
      publicKey: "",
      derivationPath: "",
    };
    const { stdout, exitCode } = await runCli(["account", "list"], {
      accounts: [envAccount],
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("(env: MY_SECRET)");
    expect(stdout).toContain("n/a");
  });

  test("list with env-backed account (env set) shows resolved address", async () => {
    const envAccount: StoredAccount = {
      name: "env-acct",
      secret: { env: "MY_SECRET" },
      publicKey: "",
      derivationPath: "",
    };
    const { stdout, exitCode } = await runCli(["account", "list"], {
      accounts: [envAccount],
      env: { MY_SECRET: TEST_MNEMONIC },
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("(env: MY_SECRET)");
    expect(stdout).not.toContain("n/a");
  });

  test("remove env-backed account works", async () => {
    const envAccount: StoredAccount = {
      name: "env-acct",
      secret: { env: "MY_SECRET" },
      publicKey: "",
      derivationPath: "",
    };
    const { stdout, exitCode } = await runCli(["account", "remove", "env-acct"], {
      accounts: [envAccount],
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("removed");
  });
});
