import { describe, expect, test } from "bun:test";
import { runCli } from "./__fixtures__/run-cli.ts";

const RPC_CACHE = JSON.stringify({
  methods: [
    "system_health",
    "system_version",
    "chain_getBlock",
    "chain_subscribeAllHeads",
    "rpc_methods",
    "exotic_uncurated",
  ],
  version: 1,
  fetchedAt: "2026-05-07T00:00:00.000Z",
});

const RPC_CACHE_FILES = {
  ".polkadot/chains/polkadot/rpc-methods.json": RPC_CACHE,
};

describe("dot rpc", () => {
  test("--help on a curated method shows description and args", async () => {
    const { stdout, exitCode } = await runCli(["polkadot.rpc.author_insertKey", "--help"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("author_insertKey");
    expect(stdout).toContain("WRITE");
    expect(stdout).toContain("keystore");
    expect(stdout).toContain("<keyType: string>");
    expect(stdout).toContain("<suri: string>");
  });

  test("--help on an unknown method shows generic info", async () => {
    const { stdout, exitCode } = await runCli(["polkadot.rpc.exotic_uncurated", "--help"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("exotic_uncurated");
    expect(stdout).toContain("No curated metadata");
  });

  test("list mode reads from cache and groups by family", async () => {
    const { stdout, exitCode } = await runCli(["polkadot.rpc"], { files: RPC_CACHE_FILES });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("RPC methods on polkadot");
    expect(stdout).toContain("system");
    expect(stdout).toContain("system_health");
    expect(stdout).toContain("chain_getBlock");
  });

  test("list --json emits structured output from cache", async () => {
    const { stdout, exitCode } = await runCli(["polkadot.rpc", "--json"], {
      files: RPC_CACHE_FILES,
    });
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.chain).toBe("polkadot");
    expect(parsed.fromCache).toBe(true);
    expect(Array.isArray(parsed.methods)).toBe(true);
    const health = parsed.methods.find((m: { method: string }) => m.method === "system_health");
    expect(health.family).toBe("system");
  });

  test("rejects a method not in the node's rpc_methods list", async () => {
    const { stderr, exitCode } = await runCli(["polkadot.rpc.bogus_method"], {
      files: RPC_CACHE_FILES,
    });
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("not exposed by the node");
  });

  test("rejects subscription methods as one-shots", async () => {
    const { stderr, exitCode } = await runCli(["polkadot.rpc.chain_subscribeAllHeads"], {
      files: RPC_CACHE_FILES,
    });
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("subscription");
  });

  test("dotpath with sub-item returns a clear error", async () => {
    const { stderr, exitCode } = await runCli(["polkadot.rpc.system_health.extra"], {
      files: RPC_CACHE_FILES,
    });
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("no sub-items");
  });

  test("rpc.<method> form works without chain prefix when --chain is set", async () => {
    const { stdout, exitCode } = await runCli(["rpc.system_health", "--help"], {
      files: RPC_CACHE_FILES,
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("system_health");
  });
});

describe("dot rpc completions", () => {
  test("completes method names from cache", async () => {
    const { stdout, exitCode } = await runCli(["__complete", "--", "polkadot.rpc."], {
      files: RPC_CACHE_FILES,
    });
    expect(exitCode).toBe(0);
    const lines = stdout.split("\n").filter(Boolean);
    expect(lines).toContain("polkadot.rpc.system_health");
    expect(lines).toContain("polkadot.rpc.exotic_uncurated");
  });

  test("filters by prefix", async () => {
    const { stdout, exitCode } = await runCli(["__complete", "--", "polkadot.rpc.system_"], {
      files: RPC_CACHE_FILES,
    });
    expect(exitCode).toBe(0);
    const lines = stdout.split("\n").filter(Boolean);
    expect(lines.every((l) => l.startsWith("polkadot.rpc.system_"))).toBe(true);
    expect(lines).toContain("polkadot.rpc.system_health");
  });
});
