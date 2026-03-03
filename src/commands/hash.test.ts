import { describe, test, expect } from "bun:test";
import { runCli } from "./__fixtures__/run-cli.ts";

describe("dot hash", () => {
  test("no args shows algorithm help", async () => {
    const { stdout, exitCode } = await runCli(["hash"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Algorithms:");
    expect(stdout).toContain("blake2b256");
    expect(stdout).toContain("blake2b128");
    expect(stdout).toContain("keccak256");
    expect(stdout).toContain("sha256");
  });

  test("blake2b256 0xdeadbeef produces 64-char hex", async () => {
    const { stdout, exitCode } = await runCli([
      "hash",
      "blake2b256",
      "0xdeadbeef",
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^0x[0-9a-f]{64}$/);
  });

  test("blake2b128 0xdeadbeef produces 32-char hex", async () => {
    const { stdout, exitCode } = await runCli([
      "hash",
      "blake2b128",
      "0xdeadbeef",
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^0x[0-9a-f]{32}$/);
  });

  test("keccak256 0xdeadbeef produces 64-char hex", async () => {
    const { stdout, exitCode } = await runCli([
      "hash",
      "keccak256",
      "0xdeadbeef",
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^0x[0-9a-f]{64}$/);
  });

  test("sha256 0xdeadbeef produces 64-char hex", async () => {
    const { stdout, exitCode } = await runCli([
      "hash",
      "sha256",
      "0xdeadbeef",
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^0x[0-9a-f]{64}$/);
  });

  test("sha256 hello produces known hash", async () => {
    const { stdout, exitCode } = await runCli(["hash", "sha256", "hello"]);
    expect(exitCode).toBe(0);
    // SHA-256("hello") = 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
    expect(stdout).toBe(
      "0x2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });

  test("sha256 --file hashes file contents", async () => {
    const { stdout, exitCode } = await runCli(
      ["hash", "sha256", "--file", "{{HOME}}/test-data.txt"],
      { files: { "test-data.txt": "hello" } },
    );
    expect(exitCode).toBe(0);
    // Same as sha256("hello")
    expect(stdout).toBe(
      "0x2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });

  test("blake2b256 --file with binary content", async () => {
    const binary = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const { stdout, exitCode } = await runCli(
      ["hash", "blake2b256", "--file", "{{HOME}}/binary.bin"],
      { files: { "binary.bin": binary } },
    );
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^0x[0-9a-f]{64}$/);
  });

  test("sha256 --stdin with piped data", async () => {
    const { stdout, exitCode } = await runCli(
      ["hash", "sha256", "--stdin"],
      { stdin: "hello" },
    );
    expect(exitCode).toBe(0);
    expect(stdout).toBe(
      "0x2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });

  test("sha256 hello --output json returns JSON", async () => {
    const { stdout, exitCode } = await runCli([
      "hash",
      "sha256",
      "hello",
      "--output",
      "json",
    ]);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.algorithm).toBe("sha256");
    expect(parsed.input).toBe("hello");
    expect(parsed.hash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  test("invalid algo sha257 suggests sha256", async () => {
    const { stderr, exitCode } = await runCli(["hash", "sha257", "hello"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("sha256");
  });

  test("unknown algo md5 errors", async () => {
    const { stderr, exitCode } = await runCli(["hash", "md5", "hello"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Unknown algorithm");
  });

  test("no input 'sha256' errors", async () => {
    const { stderr, exitCode } = await runCli(["hash", "sha256"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("No input provided");
  });

  test("multiple inputs (inline + --file) errors", async () => {
    const { stderr, exitCode } = await runCli(
      ["hash", "sha256", "hello", "--file", "{{HOME}}/test.txt"],
      { files: { "test.txt": "data" } },
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Provide only one of");
  });

  test("--file nonexistent path errors", async () => {
    const { exitCode } = await runCli([
      "hash",
      "sha256",
      "--file",
      "/nonexistent/path/file.txt",
    ]);
    expect(exitCode).toBe(1);
  });

  test("odd-length hex 0xabc errors", async () => {
    const { stderr, exitCode } = await runCli(["hash", "sha256", "0xabc"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("odd number of characters");
  });
});
