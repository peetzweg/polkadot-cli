import { describe, expect, test } from "bun:test";
import { runCli } from "./__fixtures__/run-cli.ts";

describe("dot parachain", () => {
  test("no args shows help", async () => {
    const { stdout, exitCode } = await runCli(["parachain"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Usage:");
    expect(stdout).toContain("dot parachain");
    expect(stdout).toContain("--type");
    expect(stdout).toContain("child");
    expect(stdout).toContain("sibling");
  });

  test("shows both child and sibling by default", async () => {
    const { stdout, exitCode } = await runCli(["parachain", "1000"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Child:");
    expect(stdout).toContain("Sibling:");
    expect(stdout).toContain("Public Key:");
    expect(stdout).toContain("SS58:");
  });

  test("--type child shows only child", async () => {
    const { stdout, exitCode } = await runCli(["parachain", "1000", "--type", "child"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Child:");
    expect(stdout).not.toContain("Sibling:");
  });

  test("--type sibling shows only sibling", async () => {
    const { stdout, exitCode } = await runCli(["parachain", "1000", "--type", "sibling"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Sibling:");
    expect(stdout).not.toContain("Child:");
  });

  test("public key matches expected hex for para ID 1000 child", async () => {
    const { stdout, exitCode } = await runCli(["parachain", "1000", "--type", "child"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("0x70617261e8030000000000000000000000000000000000000000000000000000");
  });

  test("public key matches expected hex for para ID 1000 sibling", async () => {
    const { stdout, exitCode } = await runCli(["parachain", "1000", "--type", "sibling"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("0x7369626ce8030000000000000000000000000000000000000000000000000000");
  });

  test("--prefix changes SS58 address", async () => {
    const def = await runCli(["parachain", "1000", "--type", "child"]);
    const p0 = await runCli(["parachain", "1000", "--type", "child", "--prefix", "0"]);
    expect(def.exitCode).toBe(0);
    expect(p0.exitCode).toBe(0);
    // Same public key, different SS58 addresses
    expect(def.stdout).toContain(
      "0x70617261e8030000000000000000000000000000000000000000000000000000",
    );
    expect(p0.stdout).toContain(
      "0x70617261e8030000000000000000000000000000000000000000000000000000",
    );
    // SS58 lines should differ
    expect(def.stdout).not.toBe(p0.stdout);
  });

  test("--output json returns valid JSON with both types", async () => {
    const { stdout, exitCode } = await runCli(["parachain", "1000", "--output", "json"]);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.paraId).toBe(1000);
    expect(parsed.prefix).toBe(42);
    expect(parsed.child).toBeDefined();
    expect(parsed.child.publicKey).toMatch(/^0x[0-9a-f]{64}$/);
    expect(parsed.child.ss58).toBeDefined();
    expect(parsed.sibling).toBeDefined();
    expect(parsed.sibling.publicKey).toMatch(/^0x[0-9a-f]{64}$/);
    expect(parsed.sibling.ss58).toBeDefined();
  });

  test("--output json --type child returns only child", async () => {
    const { stdout, exitCode } = await runCli([
      "parachain",
      "1000",
      "--type",
      "child",
      "--output",
      "json",
    ]);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.child).toBeDefined();
    expect(parsed.sibling).toBeUndefined();
  });

  test("invalid para ID errors", async () => {
    const { stderr, exitCode } = await runCli(["parachain", "abc"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Invalid parachain ID");
  });

  test("float para ID errors", async () => {
    const { stderr, exitCode } = await runCli(["parachain", "1.5"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Invalid parachain ID");
  });

  test("invalid --type errors", async () => {
    const { stderr, exitCode } = await runCli(["parachain", "1000", "--type", "invalid"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Unknown account type");
  });
});
