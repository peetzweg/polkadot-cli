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

  test("--help shows same custom help as bare command", async () => {
    const bare = await runCli(["account"]);
    const help = await runCli(["account", "--help"]);
    expect(help.exitCode).toBe(0);
    expect(help.stdout).toContain("dot account create");
    expect(help.stdout).toContain("dot account list");
    expect(help.stdout).toBe(bare.stdout);
  });

  test("accounts shorthand lists accounts", async () => {
    const { stdout, exitCode } = await runCli(["accounts"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Dev Accounts");
    expect(stdout).toContain("Alice");
  });

  test("unknown input foo falls through to inspect and errors", async () => {
    const { stderr, exitCode } = await runCli(["account", "foo"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Cannot identify");
  });

  test("create my-test succeeds", async () => {
    const { stdout, exitCode } = await runCli(["account", "create", "my-test"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Account Created");
    expect(stdout).toContain("Mnemonic:");
    expect(stdout).toContain("Address:");
  });

  test("new is an alias for create", async () => {
    const { stdout, exitCode } = await runCli(["account", "new", "my-test"]);
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

  test("import name (no --secret or --env) errors", async () => {
    const { stderr, exitCode } = await runCli(["account", "import", "my-key"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("--secret or --env is required");
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

  test("delete is an alias for remove", async () => {
    const { stdout, exitCode } = await runCli(["account", "delete", "my-account"], {
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

  test("add is an alias for import (--secret)", async () => {
    const { stdout, exitCode } = await runCli([
      "account",
      "add",
      "my-imported",
      "--secret",
      TEST_MNEMONIC,
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Account Imported");
    expect(stdout).toContain("Address:");
  });

  test("add is an alias for import (--env)", async () => {
    const { stdout, exitCode } = await runCli(
      ["account", "add", "env-test", "--env", "MY_SECRET"],
      { env: { MY_SECRET: TEST_MNEMONIC } },
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Account Imported");
    expect(stdout).toContain("Address:");
  });

  test("import name --env VAR (env set) succeeds with address", async () => {
    const { stdout, exitCode } = await runCli(
      ["account", "import", "env-test", "--env", "MY_SECRET"],
      {
        env: { MY_SECRET: TEST_MNEMONIC },
      },
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Account Imported");
    expect(stdout).toContain("Address:");
  });

  test("import name --env VAR (env not set) succeeds with deferred", async () => {
    const { stdout, exitCode } = await runCli(
      ["account", "import", "env-test", "--env", "MY_SECRET"],
      { env: { MY_SECRET: "" } },
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Account Imported");
    expect(stdout).toContain("will resolve");
  });

  test("import --secret and --env together errors", async () => {
    const { stderr, exitCode } = await runCli(
      ["account", "import", "env-test", "--secret", TEST_MNEMONIC, "--env", "MY_SECRET"],
      { env: { MY_SECRET: TEST_MNEMONIC } },
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Use --secret or --env, not both");
  });

  test("import alice --env VAR (dev name) errors", async () => {
    const { stderr, exitCode } = await runCli(
      ["account", "import", "alice", "--env", "MY_SECRET"],
      {
        env: { MY_SECRET: TEST_MNEMONIC },
      },
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain("built-in dev account");
  });

  test("import duplicate --env VAR errors", async () => {
    const { stderr, exitCode } = await runCli(
      ["account", "import", "my-account", "--env", "MY_SECRET"],
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

  // multi-delete tests

  test("remove multiple names succeeds", async () => {
    const accounts: StoredAccount[] = [
      STORED_ACCOUNT,
      { ...STORED_ACCOUNT, name: "acct-2" },
      { ...STORED_ACCOUNT, name: "acct-3" },
    ];
    const { stdout, exitCode } = await runCli(["account", "remove", "my-account", "acct-3"], {
      accounts,
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain('"my-account" removed');
    expect(stdout).toContain('"acct-3" removed');
  });

  test("remove multiple with one not-found errors without deleting any", async () => {
    const accounts: StoredAccount[] = [STORED_ACCOUNT, { ...STORED_ACCOUNT, name: "acct-2" }];
    const { stderr, exitCode } = await runCli(["account", "remove", "my-account", "ghost"], {
      accounts,
    });
    expect(exitCode).toBe(1);
    expect(stderr).toContain('"ghost" not found');
  });

  test("remove multiple with one dev account errors without deleting any", async () => {
    const { stderr, exitCode } = await runCli(["account", "remove", "my-account", "alice"], {
      accounts: [STORED_ACCOUNT],
    });
    expect(exitCode).toBe(1);
    expect(stderr).toContain("built-in dev account");
  });

  test("delete multiple (alias) succeeds", async () => {
    const accounts: StoredAccount[] = [STORED_ACCOUNT, { ...STORED_ACCOUNT, name: "acct-2" }];
    const { stdout, exitCode } = await runCli(["account", "delete", "my-account", "acct-2"], {
      accounts,
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain('"my-account" removed');
    expect(stdout).toContain('"acct-2" removed');
  });

  // --path tests

  test("create --path //Test creates account with derivation path", async () => {
    const { stdout, exitCode } = await runCli([
      "account",
      "create",
      "my-derived",
      "--path",
      "//Test",
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Account Created");
    expect(stdout).toContain("Path:");
    expect(stdout).toContain("//Test");
    expect(stdout).toContain("Address:");
  });

  test("import --secret with --path stores path", async () => {
    const { stdout, exitCode } = await runCli([
      "account",
      "import",
      "my-derived",
      "--secret",
      TEST_MNEMONIC,
      "--path",
      "//Bar",
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Account Imported");
    expect(stdout).toContain("Path:");
    expect(stdout).toContain("//Bar");
    expect(stdout).toContain("Address:");
  });

  test("import --env with --path stores path", async () => {
    const { stdout, exitCode } = await runCli(
      ["account", "import", "env-derived", "--env", "MY_SECRET", "--path", "//ci"],
      { env: { MY_SECRET: TEST_MNEMONIC } },
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Account Imported");
    expect(stdout).toContain("Path:");
    expect(stdout).toContain("//ci");
    expect(stdout).toContain("Address:");
  });

  test("derive creates child account from source", async () => {
    const { stdout, exitCode } = await runCli(
      ["account", "derive", "my-account", "child-acct", "--path", "//child"],
      { accounts: [STORED_ACCOUNT] },
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Account Derived");
    expect(stdout).toContain("child-acct");
    expect(stdout).toContain("my-account");
    expect(stdout).toContain("//child");
    expect(stdout).toContain("Address:");
  });

  test("derive without --path errors", async () => {
    const { stderr, exitCode } = await runCli(["account", "derive", "my-account", "child-acct"], {
      accounts: [STORED_ACCOUNT],
    });
    expect(exitCode).toBe(1);
    expect(stderr).toContain("--path is required");
  });

  test("derive with nonexistent source errors", async () => {
    const { stderr, exitCode } = await runCli([
      "account",
      "derive",
      "nonexistent",
      "child-acct",
      "--path",
      "//x",
    ]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("not found");
  });

  test("derive without new name errors", async () => {
    const { stderr, exitCode } = await runCli(
      ["account", "derive", "my-account", "--path", "//x"],
      { accounts: [STORED_ACCOUNT] },
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain("New account name is required");
  });

  test("derive from env-backed source works", async () => {
    const envAccount: StoredAccount = {
      name: "env-source",
      secret: { env: "MY_SECRET" },
      publicKey: "",
      derivationPath: "",
    };
    const { stdout, exitCode } = await runCli(
      ["account", "derive", "env-source", "env-child", "--path", "//x"],
      { accounts: [envAccount], env: { MY_SECRET: TEST_MNEMONIC } },
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Account Derived");
    expect(stdout).toContain("env-child");
    expect(stdout).toContain("Address:");
  });

  test("list shows derivation path for accounts with one", async () => {
    const derivedAccount: StoredAccount = {
      name: "derived-acct",
      secret: TEST_MNEMONIC,
      publicKey: "0x44a996beb1eef7bdcab976ab6d2ca26104834164ecf28fb375600576fcc6eb0f",
      derivationPath: "//staking",
    };
    const { stdout, exitCode } = await runCli(["account", "list"], {
      accounts: [derivedAccount],
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("derived-acct (//staking)");
  });

  test("list shows path and env badge combined", async () => {
    const envDerived: StoredAccount = {
      name: "env-derived",
      secret: { env: "MY_SECRET" },
      publicKey: "",
      derivationPath: "//ci",
    };
    const { stdout, exitCode } = await runCli(["account", "list"], {
      accounts: [envDerived],
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("env-derived (//ci) (env: MY_SECRET)");
  });

  // --path multi-segment tests

  test("create --path //polkadot//0/wallet works with multi-segment path", async () => {
    const { stdout, exitCode } = await runCli([
      "account",
      "create",
      "multi-seg",
      "--path",
      "//polkadot//0/wallet",
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Account Created");
    expect(stdout).toContain("Path:");
    expect(stdout).toContain("//polkadot//0/wallet");
    expect(stdout).toContain("Address:");
  });

  test("import --secret with multi-segment --path //hard/soft//hard2", async () => {
    const { stdout, exitCode } = await runCli([
      "account",
      "import",
      "multi-imported",
      "--secret",
      TEST_MNEMONIC,
      "--path",
      "//hard/soft//hard2",
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Account Imported");
    expect(stdout).toContain("Path:");
    expect(stdout).toContain("//hard/soft//hard2");
    expect(stdout).toContain("Address:");
  });

  test("import with different multi-segment paths produces different addresses", async () => {
    const run = async (path: string) => {
      const { stdout, exitCode } = await runCli([
        "account",
        "import",
        `acct-${path.replace(/\//g, "-")}`,
        "--secret",
        TEST_MNEMONIC,
        "--path",
        path,
      ]);
      expect(exitCode).toBe(0);
      const match = stdout.match(/Address:\s+(\S+)/);
      expect(match).toBeTruthy();
      return match![1];
    };

    const addr1 = await run("//a");
    const addr2 = await run("//a//b");
    const addr3 = await run("//a/b");

    expect(addr1).not.toBe(addr2);
    expect(addr1).not.toBe(addr3);
    expect(addr2).not.toBe(addr3);
  });

  test("derive with multi-segment --path //polkadot//0/wallet", async () => {
    const { stdout, exitCode } = await runCli(
      ["account", "derive", "my-account", "multi-child", "--path", "//polkadot//0/wallet"],
      { accounts: [STORED_ACCOUNT] },
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Account Derived");
    expect(stdout).toContain("multi-child");
    expect(stdout).toContain("//polkadot//0/wallet");
    expect(stdout).toContain("Address:");
  });

  // inspect tests

  test("inspect alice shows public key and SS58", async () => {
    const { stdout, exitCode } = await runCli(["account", "inspect", "alice"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Account Info");
    expect(stdout).toContain("Alice");
    expect(stdout).toContain("0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d");
    expect(stdout).toContain("5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY");
  });

  test("inspect alice (implicit, no inspect keyword) works", async () => {
    const { stdout, exitCode } = await runCli(["account", "alice"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Account Info");
    expect(stdout).toContain("Alice");
    expect(stdout).toContain("5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY");
  });

  test("inspect stored account by name", async () => {
    const { stdout, exitCode } = await runCli(["account", "inspect", "my-account"], {
      accounts: [STORED_ACCOUNT],
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Account Info");
    expect(stdout).toContain("my-account");
    expect(stdout).toContain(STORED_ACCOUNT.publicKey);
  });

  test("inspect SS58 address decodes to public key", async () => {
    const { stdout, exitCode } = await runCli([
      "account",
      "inspect",
      "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Account Info");
    expect(stdout).toContain("0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d");
    expect(stdout).toContain("SS58:");
  });

  test("inspect hex public key shows SS58", async () => {
    const { stdout, exitCode } = await runCli([
      "account",
      "inspect",
      "0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d",
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Account Info");
    expect(stdout).toContain("5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY");
  });

  test("inspect with --prefix 0 encodes Polkadot address", async () => {
    const { stdout, exitCode } = await runCli(["account", "inspect", "alice", "--prefix", "0"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Prefix:      0");
    // Polkadot prefix=0 addresses start with '1'
    expect(stdout).toMatch(/SS58:\s+1\S+/);
  });

  test("inspect with --output json returns valid JSON", async () => {
    const { stdout, exitCode } = await runCli(["account", "inspect", "alice", "--output", "json"]);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.name).toBe("Alice");
    expect(parsed.publicKey).toBe(
      "0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d",
    );
    expect(parsed.ss58).toBe("5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY");
    expect(parsed.prefix).toBe(42);
  });

  test("inspect invalid input errors", async () => {
    const { stderr, exitCode } = await runCli(["account", "inspect", "garbage!!!"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Cannot identify");
  });

  test("inspect env-backed account with env set resolves", async () => {
    const envAccount: StoredAccount = {
      name: "env-acct",
      secret: { env: "MY_SECRET" },
      publicKey: "",
      derivationPath: "",
    };
    const { stdout, exitCode } = await runCli(["account", "inspect", "env-acct"], {
      accounts: [envAccount],
      env: { MY_SECRET: TEST_MNEMONIC },
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Account Info");
    expect(stdout).toContain("env-acct");
    expect(stdout).toContain("Public Key:");
  });

  test("inspect env-backed account without env errors", async () => {
    const envAccount: StoredAccount = {
      name: "env-acct",
      secret: { env: "MY_SECRET" },
      publicKey: "",
      derivationPath: "",
    };
    const { stderr, exitCode } = await runCli(["account", "inspect", "env-acct"], {
      accounts: [envAccount],
      env: { MY_SECRET: "" },
    });
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Cannot derive");
  });

  // ---------------------------------------------------------------------------
  // watch-only account tests
  // ---------------------------------------------------------------------------

  const WATCH_ONLY: StoredAccount = {
    name: "treasury",
    publicKey: "0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d",
    derivationPath: "",
  };

  test("add <name> <ss58> creates watch-only account", async () => {
    const { stdout, exitCode } = await runCli([
      "account",
      "add",
      "treasury",
      "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Account Added (watch-only)");
    expect(stdout).toContain("treasury");
    expect(stdout).toContain("5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY");
  });

  test("add <name> <hex-key> creates watch-only from hex", async () => {
    const { stdout, exitCode } = await runCli([
      "account",
      "add",
      "hex-watch",
      "0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d",
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Account Added (watch-only)");
    expect(stdout).toContain("hex-watch");
  });

  test("add (no name) errors", async () => {
    const { stderr, exitCode } = await runCli(["account", "add"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("name is required");
  });

  test("add <name> (no address) errors", async () => {
    const { stderr, exitCode } = await runCli(["account", "add", "lonely"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Address is required");
  });

  test("add alice <ss58> (dev name) errors", async () => {
    const { stderr, exitCode } = await runCli([
      "account",
      "add",
      "alice",
      "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
    ]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("built-in dev account");
  });

  test("add existing-name <ss58> (duplicate) errors", async () => {
    const { stderr, exitCode } = await runCli(
      ["account", "add", "treasury", "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"],
      { accounts: [WATCH_ONLY] },
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain("already exists");
  });

  test("add <name> garbage!!! (invalid address) errors", async () => {
    const { stderr, exitCode } = await runCli(["account", "add", "bad-addr", "garbage!!!"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Invalid address");
  });

  test("add with --secret still works as import", async () => {
    const { stdout, exitCode } = await runCli([
      "account",
      "add",
      "secret-add",
      "--secret",
      TEST_MNEMONIC,
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Account Imported");
    expect(stdout).toContain("Address:");
  });

  test("list shows (watch-only) badge for watch-only account", async () => {
    const { stdout, exitCode } = await runCli(["account", "list"], {
      accounts: [WATCH_ONLY],
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("(watch-only)");
    expect(stdout).toContain("treasury");
  });

  test("list shows address for watch-only account", async () => {
    const { stdout, exitCode } = await runCli(["account", "list"], {
      accounts: [WATCH_ONLY],
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY");
  });

  test("inspect watch-only account works", async () => {
    const { stdout, exitCode } = await runCli(["account", "inspect", "treasury"], {
      accounts: [WATCH_ONLY],
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Account Info");
    expect(stdout).toContain("treasury");
    expect(stdout).toContain(WATCH_ONLY.publicKey);
  });

  test("remove watch-only account works", async () => {
    const { stdout, exitCode } = await runCli(["account", "remove", "treasury"], {
      accounts: [WATCH_ONLY],
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("removed");
  });

  test("derive from watch-only source errors", async () => {
    const { stderr, exitCode } = await runCli(
      ["account", "derive", "treasury", "child-acct", "--path", "//child"],
      { accounts: [WATCH_ONLY] },
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain("watch-only");
  });
});
