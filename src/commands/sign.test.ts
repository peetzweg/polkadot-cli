import { describe, expect, test } from "bun:test";
import { runCli, TEST_MNEMONIC } from "./__fixtures__/run-cli.ts";

const SIG_HEX_PATTERN = /0x[0-9a-f]{128}/;

describe("dot sign", () => {
  test("no args shows help", async () => {
    const { stdout, exitCode } = await runCli(["sign"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Usage:");
    expect(stdout).toContain("--from");
    expect(stdout).toContain("--type");
    expect(stdout).toContain("--file");
    expect(stdout).toContain("--stdin");
    expect(stdout).toContain("--output json");
  });

  test("--help shows same help as bare command", async () => {
    const bare = await runCli(["sign"]);
    const help = await runCli(["sign", "--help"]);
    expect(help.exitCode).toBe(0);
    expect(help.stdout).toBe(bare.stdout);
  });

  // Pretty output tests

  test("sign text message shows structured output", async () => {
    const { stdout, exitCode } = await runCli(["sign", "hello world", "--from", "alice"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Type:");
    expect(stdout).toContain("Sr25519");
    expect(stdout).toContain("Message:");
    expect(stdout).toContain("Signature:");
    expect(stdout).toContain("Enum:");
    expect(stdout).toMatch(SIG_HEX_PATTERN);
  });

  test("sign hex input shows hex message in output", async () => {
    const { stdout, exitCode } = await runCli(["sign", "0xdeadbeef", "--from", "alice"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("0xdeadbeef");
    expect(stdout).toContain("Sr25519(0x");
  });

  test("sign text shows UTF-8 as hex in message field", async () => {
    const { stdout, exitCode } = await runCli([
      "sign",
      "hello",
      "--from",
      "alice",
      "--output",
      "json",
    ]);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    // "hello" in hex is 0x68656c6c6f
    expect(parsed.message).toBe("0x68656c6c6f");
  });

  // JSON output tests

  test("--output json returns valid JSON with all fields", async () => {
    const { stdout, exitCode } = await runCli([
      "sign",
      "hello",
      "--from",
      "alice",
      "--output",
      "json",
    ]);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.type).toBe("Sr25519");
    expect(parsed.message).toMatch(/^0x[0-9a-f]+$/);
    expect(parsed.signature).toMatch(SIG_HEX_PATTERN);
    expect(parsed.enum).toMatch(/^Sr25519\(0x[0-9a-f]{128}\)$/);
  });

  test("json enum field matches Sr25519(signature)", async () => {
    const { stdout, exitCode } = await runCli([
      "sign",
      "0xdeadbeef",
      "--from",
      "alice",
      "--output",
      "json",
    ]);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.enum).toBe(`Sr25519(${parsed.signature})`);
  });

  test("json message field matches input hex", async () => {
    const { stdout, exitCode } = await runCli([
      "sign",
      "0xdeadbeef",
      "--from",
      "alice",
      "--output",
      "json",
    ]);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.message).toBe("0xdeadbeef");
  });

  // Input source tests

  test("different accounts produce different signatures", async () => {
    const alice = await runCli(["sign", "hello", "--from", "alice", "--output", "json"]);
    const bob = await runCli(["sign", "hello", "--from", "bob", "--output", "json"]);
    expect(alice.exitCode).toBe(0);
    expect(bob.exitCode).toBe(0);
    const a = JSON.parse(alice.stdout);
    const b = JSON.parse(bob.stdout);
    expect(a.signature).not.toBe(b.signature);
  });

  test("different messages produce different signatures", async () => {
    const a = await runCli(["sign", "hello", "--from", "alice", "--output", "json"]);
    const b = await runCli(["sign", "world", "--from", "alice", "--output", "json"]);
    expect(a.exitCode).toBe(0);
    expect(b.exitCode).toBe(0);
    expect(JSON.parse(a.stdout).signature).not.toBe(JSON.parse(b.stdout).signature);
  });

  test("sign with --file", async () => {
    const { stdout, exitCode } = await runCli(
      ["sign", "--file", "{{HOME}}/message.txt", "--from", "alice"],
      { files: { "message.txt": "hello world" } },
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Sr25519");
    expect(stdout).toMatch(SIG_HEX_PATTERN);
  });

  test("sign with --file binary content", async () => {
    const binary = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const { stdout, exitCode } = await runCli(
      ["sign", "--file", "{{HOME}}/data.bin", "--from", "alice", "--output", "json"],
      { files: { "data.bin": binary } },
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.message).toBe("0xdeadbeef");
    expect(parsed.signature).toMatch(SIG_HEX_PATTERN);
  });

  test("sign with --stdin", async () => {
    const { stdout, exitCode } = await runCli(["sign", "--stdin", "--from", "alice"], {
      stdin: "hello world",
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Sr25519");
    expect(stdout).toMatch(SIG_HEX_PATTERN);
  });

  // Account type tests

  test("sign with stored account (mnemonic)", async () => {
    const { stdout, exitCode } = await runCli(
      ["sign", "hello", "--from", "my-account", "--output", "json"],
      {
        accounts: [
          {
            name: "my-account",
            secret: TEST_MNEMONIC,
            publicKey: "0x33a6f3093f158a7109f679410bef1a0c54168145e0cecb4df006c1c2fffb1f09",
            derivationPath: "",
          },
        ],
      },
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.type).toBe("Sr25519");
    expect(parsed.signature).toMatch(SIG_HEX_PATTERN);
  });

  test("sign with env-backed account", async () => {
    const { stdout, exitCode } = await runCli(
      ["sign", "hello", "--from", "env-account", "--output", "json"],
      {
        accounts: [
          {
            name: "env-account",
            secret: { env: "TEST_SECRET" },
            publicKey: "0x33a6f3093f158a7109f679410bef1a0c54168145e0cecb4df006c1c2fffb1f09",
            derivationPath: "",
          },
        ],
        env: { TEST_SECRET: TEST_MNEMONIC },
      },
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.type).toBe("Sr25519");
    expect(parsed.signature).toMatch(SIG_HEX_PATTERN);
  });

  // --type flag tests

  test("--type sr25519 works (explicit default)", async () => {
    const { stdout, exitCode } = await runCli([
      "sign",
      "hello",
      "--from",
      "alice",
      "--type",
      "sr25519",
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Sr25519");
    expect(stdout).toMatch(SIG_HEX_PATTERN);
  });

  test("--type is case-insensitive", async () => {
    const { stdout, exitCode } = await runCli([
      "sign",
      "hello",
      "--from",
      "alice",
      "--type",
      "Sr25519",
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Sr25519");
    expect(stdout).toMatch(SIG_HEX_PATTERN);
  });

  // Error cases

  test("missing --from errors", async () => {
    const { stderr, exitCode } = await runCli(["sign", "hello"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("--from is required");
  });

  test("unknown account errors", async () => {
    const { stderr, exitCode } = await runCli(["sign", "hello", "--from", "nonexistent"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Unknown account");
  });

  test("watch-only account errors", async () => {
    const { stderr, exitCode } = await runCli(["sign", "hello", "--from", "watch-only"], {
      accounts: [
        {
          name: "watch-only",
          publicKey: "0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d",
          derivationPath: "",
        },
      ],
    });
    expect(exitCode).toBe(1);
    expect(stderr).toContain("watch-only");
  });

  test("unsupported --type errors", async () => {
    const { stderr, exitCode } = await runCli([
      "sign",
      "hello",
      "--from",
      "alice",
      "--type",
      "ed25519",
    ]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Unsupported signature type");
    expect(stderr).toContain("sr25519");
  });

  test("multiple inputs (inline + --file) errors", async () => {
    const { stderr, exitCode } = await runCli(
      ["sign", "hello", "--file", "{{HOME}}/msg.txt", "--from", "alice"],
      { files: { "msg.txt": "data" } },
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Provide only one of");
  });

  test("no input with --from shows help", async () => {
    const { exitCode } = await runCli(["sign", "--from", "alice"]);
    expect(exitCode).toBe(0);
  });

  test("odd-length hex input errors", async () => {
    const { stderr, exitCode } = await runCli(["sign", "0xabc", "--from", "alice"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("odd number of characters");
  });

  test("--file nonexistent path errors", async () => {
    const { exitCode } = await runCli([
      "sign",
      "--file",
      "/nonexistent/path/file.txt",
      "--from",
      "alice",
    ]);
    expect(exitCode).toBe(1);
  });

  test("sign empty hex produces valid signature", async () => {
    const { stdout, exitCode } = await runCli([
      "sign",
      "0x",
      "--from",
      "alice",
      "--output",
      "json",
    ]);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.message).toBe("0x");
    expect(parsed.signature).toMatch(SIG_HEX_PATTERN);
  });
});
