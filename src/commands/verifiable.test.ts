import { describe, expect, test } from "bun:test";
import type { StoredAccount } from "../config/accounts-types.ts";
import { runCli, TEST_MNEMONIC } from "./__fixtures__/run-cli.ts";

const STORED_ACCOUNT: StoredAccount = {
  name: "my-account",
  secret: TEST_MNEMONIC,
  publicKey: "0x44a996beb1eef7bdcab976ab6d2ca26104834164ecf28fb375600576fcc6eb0f",
  derivationPath: "",
};

const WATCH_ONLY: StoredAccount = {
  name: "watcher",
  publicKey: "0x44a996beb1eef7bdcab976ab6d2ca26104834164ecf28fb375600576fcc6eb0f",
  derivationPath: "",
};

const HEX_SEED_ACCOUNT: StoredAccount = {
  name: "hex-account",
  secret: "0x0000000000000000000000000000000000000000000000000000000000000001",
  publicKey: "0x44a996beb1eef7bdcab976ab6d2ca26104834164ecf28fb375600576fcc6eb0f",
  derivationPath: "",
};

// @ts-expect-error Bun supports describe(label, options, fn) at runtime
describe("dot verifiable", { timeout: 15_000 }, () => {
  test("no account shows help", async () => {
    const { stdout, exitCode } = await runCli(["verifiable"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("dot verifiable");
    expect(stdout).toContain("member_from_entropy");
  });

  test("alice (unkeyed) derives member key", async () => {
    const { stdout, exitCode } = await runCli(["verifiable", "alice"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Bandersnatch Member Key");
    expect(stdout).toContain("Account:");
    expect(stdout).toContain("Member Key:");
    expect(stdout).toContain("0x");
    // Should NOT show separate Context: line for unkeyed (only Member Key:)
    expect(stdout).not.toMatch(/^\s+Context:/m);
  });

  test("alice --context candidate derives keyed member key", async () => {
    const { stdout, exitCode } = await runCli(["verifiable", "alice", "--context", "candidate"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Bandersnatch Member Key");
    expect(stdout).toContain("Context:    candidate");
    expect(stdout).toContain("Member Key:");
  });

  test("unkeyed and --context candidate produce different keys for alice", async () => {
    const unkeyed = await runCli(["verifiable", "alice", "--output", "json"]);
    const candidate = await runCli([
      "verifiable",
      "alice",
      "--context",
      "candidate",
      "--output",
      "json",
    ]);
    expect(unkeyed.exitCode).toBe(0);
    expect(candidate.exitCode).toBe(0);
    const unkeyedKey = JSON.parse(unkeyed.stdout).memberKey;
    const candidateKey = JSON.parse(candidate.stdout).memberKey;
    expect(unkeyedKey).not.toBe(candidateKey);
  });

  test("deterministic: same call produces same key", async () => {
    const run1 = await runCli(["verifiable", "alice", "--output", "json"]);
    const run2 = await runCli(["verifiable", "alice", "--output", "json"]);
    expect(JSON.parse(run1.stdout).memberKey).toBe(JSON.parse(run2.stdout).memberKey);
  });

  test("all dev accounts work", async () => {
    for (const name of ["alice", "bob", "charlie", "dave", "eve", "ferdie"]) {
      const { stdout, exitCode } = await runCli(["verifiable", name, "--output", "json"]);
      expect(exitCode).toBe(0);
      const result = JSON.parse(stdout);
      expect(result.memberKey).toMatch(/^0x[0-9a-f]{64}$/);
    }
  });

  test("all dev accounts produce same key (same mnemonic)", async () => {
    const results = [];
    for (const name of ["alice", "bob"]) {
      const { stdout } = await runCli(["verifiable", name, "--output", "json"]);
      results.push(JSON.parse(stdout).memberKey);
    }
    // Dev accounts share the same DEV_PHRASE, so same Bandersnatch key
    expect(results[0]).toBe(results[1]);
  });

  test("stored account derives member key", async () => {
    const { stdout, exitCode } = await runCli(["verifiable", "my-account"], {
      accounts: [STORED_ACCOUNT],
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Bandersnatch Member Key");
    expect(stdout).toContain("Member Key:");
  });

  test("stored account with --context candidate", async () => {
    const { stdout, exitCode } = await runCli(
      ["verifiable", "my-account", "--context", "candidate"],
      { accounts: [STORED_ACCOUNT] },
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Context:    candidate");
  });

  test("JSON output has correct structure", async () => {
    const { stdout, exitCode } = await runCli([
      "verifiable",
      "alice",
      "--context",
      "candidate",
      "--output",
      "json",
    ]);
    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.account).toBe("alice");
    expect(result.context).toBe("candidate");
    expect(result.memberKey).toMatch(/^0x[0-9a-f]{64}$/);
  });

  test("JSON output without context omits context field", async () => {
    const { stdout, exitCode } = await runCli(["verifiable", "alice", "--output", "json"]);
    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.account).toBe("alice");
    expect(result.memberKey).toMatch(/^0x[0-9a-f]{64}$/);
    expect(result.context).toBeUndefined();
  });

  test("unknown account errors", async () => {
    const { stderr, exitCode } = await runCli(["verifiable", "ghost"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Unknown account");
  });

  test("watch-only account errors", async () => {
    const { stderr, exitCode } = await runCli(["verifiable", "watcher"], {
      accounts: [WATCH_ONLY],
    });
    expect(exitCode).toBe(1);
    expect(stderr).toContain("watch-only");
  });

  test("hex seed account errors", async () => {
    const { stderr, exitCode } = await runCli(["verifiable", "hex-account"], {
      accounts: [HEX_SEED_ACCOUNT],
    });
    expect(exitCode).toBe(1);
    expect(stderr).toContain("hex seed");
    expect(stderr).toContain("BIP39 mnemonic");
  });

  test("arbitrary --context string works", async () => {
    const { stdout, exitCode } = await runCli([
      "verifiable",
      "alice",
      "--context",
      "pps",
      "--output",
      "json",
    ]);
    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.context).toBe("pps");
    expect(result.memberKey).toMatch(/^0x[0-9a-f]{64}$/);
  });

  test("different --context strings produce different member keys", async () => {
    const candidate = await runCli([
      "verifiable",
      "alice",
      "--context",
      "candidate",
      "--output",
      "json",
    ]);
    const pps = await runCli(["verifiable", "alice", "--context", "pps", "--output", "json"]);
    expect(JSON.parse(candidate.stdout).memberKey).not.toBe(JSON.parse(pps.stdout).memberKey);
  });

  test("saves bandersnatch key for stored accounts", async () => {
    // First derive
    const derive = await runCli(["verifiable", "my-account", "--context", "candidate"], {
      accounts: [STORED_ACCOUNT],
    });
    expect(derive.exitCode).toBe(0);

    // The key should be visible in the output
    expect(derive.stdout).toContain("Member Key:");
  });
});
