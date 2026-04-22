import { describe, expect, test } from "bun:test";
import { findAccount } from "./accounts-store.ts";
import type { AccountsFile } from "./accounts-types.ts";

const file: AccountsFile = {
  accounts: [
    { name: "Alice", secret: "0x1", publicKey: "0xaa", derivationPath: "" },
    { name: "Bob", secret: "0x2", publicKey: "0xbb", derivationPath: "//hard" },
  ],
};

describe("findAccount", () => {
  test("finds account by exact name match", () => {
    const result = findAccount(file, "Alice");
    expect(result).toEqual(file.accounts[0]);
  });

  test("finds account by case-insensitive match", () => {
    const result = findAccount(file, "alice");
    expect(result).toEqual(file.accounts[0]);
  });

  test("returns undefined when no account matches", () => {
    const result = findAccount(file, "Charlie");
    expect(result).toBeUndefined();
  });
});

// DOT_HOME save/load is covered end-to-end by every subprocess test that
// goes through the runCli fixture (src/commands/__fixtures__/run-cli.ts)
// — that fixture sets DOT_HOME on each spawn so writes land in a per-test
// tmpdir. In-process mutation of process.env.DOT_HOME races against other
// concurrent tests (bun test --concurrent), so we don't do it here.
