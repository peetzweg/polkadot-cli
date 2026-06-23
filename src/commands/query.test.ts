import { beforeAll, describe, expect, test } from "bun:test";
import { existsSync, linkSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DEFAULT_CONFIG } from "../config/types.ts";
import type { StorageItemInfo } from "../core/metadata.ts";
import { getTestMetadata } from "./__fixtures__/load-metadata.ts";
import { runCli } from "./__fixtures__/run-cli.ts";
import { handleQuery, parseStorageKeys } from "./query.ts";

const meta = getTestMetadata();

// ---------------------------------------------------------------------------
// Ensure metadata + config exist in real $HOME for in-process tests.
// ---------------------------------------------------------------------------
const FIXTURE_METADATA = join(import.meta.dir, "__fixtures__/polkadot-metadata.bin");
const DOT_DIR = join(homedir(), ".polkadot");

beforeAll(() => {
  const metaDir = join(DOT_DIR, "chains", "polkadot");
  const metaPath = join(metaDir, "metadata.bin");
  if (!existsSync(metaPath)) {
    mkdirSync(metaDir, { recursive: true });
    linkSync(FIXTURE_METADATA, metaPath);
  }
  const configPath = join(DOT_DIR, "config.json");
  if (!existsSync(configPath)) {
    writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG));
  }
});

// ---------------------------------------------------------------------------
// In-process JSON output coverage for handleQuery listing paths.
// ---------------------------------------------------------------------------

// @ts-expect-error Bun supports describe(label, options, fn) at runtime
describe("handleQuery JSON output (in-process coverage)", { timeout: 15_000 }, () => {
  // These exercise the listing paths' `await writeStdout(...)` calls
  // end-to-end. We intentionally don't patch process.stdout.write here
  // because `bun test --concurrent` shares stdout globally and patches
  // race across tests; the writeStdout primitive itself is verified in
  // src/core/output.test.ts, and the user-facing JSON shape is covered
  // by the runCli-based --json tests below.
  test("category-only with json", async () => {
    await handleQuery(undefined, [], { json: true, chain: "polkadot" });
  });
  test("pallet-only with json", async () => {
    await handleQuery("System", [], { json: true, chain: "polkadot" });
  });
});

// @ts-expect-error Bun supports describe(label, options, fn) at runtime
describe("dot query", { timeout: 15_000 }, () => {
  test("category-only lists pallets with storage", async () => {
    const { stdout, exitCode } = await runCli(["query"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Pallets with storage");
    expect(stdout).toContain("System");
  });

  test("chain prefix works (4-segment)", async () => {
    const { stdout, exitCode } = await runCli(["polkadot.query.System.Number"]);
    expect(exitCode).toBe(0);
    expect(stdout).toBeTruthy();
  }, 15_000);

  test("stdout does not contain chain info prefix", async () => {
    const { stdout, exitCode } = await runCli(["polkadot.query.System.Number"]);
    expect(exitCode).toBe(0);
    expect(stdout).not.toContain("chain:");
    expect(stdout).not.toContain("chain: polkadot");
  }, 15_000);

  test("json output is valid JSON with no extra text", async () => {
    const { stdout, exitCode } = await runCli(["polkadot.query.System.Number", "--output", "json"]);
    expect(exitCode).toBe(0);
    expect(() => JSON.parse(stdout)).not.toThrow();
  }, 15_000);

  test("chain prefix + --chain flag errors", async () => {
    const { stderr, exitCode } = await runCli([
      "polkadot.query.System.Number",
      "--chain",
      "polkadot",
    ]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Chain specified both as prefix");
  });

  test("case-insensitive chain prefix resolves correctly", async () => {
    const { stdout, exitCode } = await runCli(["Polkadot.query.System.Number"]);
    expect(exitCode).toBe(0);
    expect(stdout).toBeTruthy();
  }, 15_000);

  test("case-insensitive --chain flag resolves correctly", async () => {
    const { stdout, exitCode } = await runCli(["query.System.Number", "--chain", "POLKADOT"]);
    expect(exitCode).toBe(0);
    expect(stdout).toBeTruthy();
  }, 15_000);

  test("json output has no progress messages on stdout", async () => {
    const { stdout, exitCode } = await runCli(["query.System.Number", "--output", "json"]);
    expect(exitCode).toBe(0);
    expect(stdout).not.toContain("Fetching metadata");
    expect(stdout).not.toContain("Connecting");
    expect(() => JSON.parse(stdout)).not.toThrow();
  }, 15_000);

  test("pallet-only lists storage items", async () => {
    const { stdout, exitCode } = await runCli(["query.System"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("System Storage");
    expect(stdout).toContain("Account");
    expect(stdout).toContain("[map]");
  });

  test("dot query.System shows pallet storage listing", async () => {
    const { stdout, exitCode } = await runCli(["query.System"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("System Storage");
    // Should list known storage items
    expect(stdout).toContain("Number");
    expect(stdout).toContain("BlockHash");
  });

  test("dot query shows pallet list (category-only mode)", async () => {
    const { stdout, exitCode } = await runCli(["query"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Pallets with storage");
    expect(stdout).toContain("Balances");
    expect(stdout).toContain("Staking");
  });

  test("storage listing shows [map] tag for map items", async () => {
    const { stdout, exitCode } = await runCli(["query.System"]);
    expect(exitCode).toBe(0);
    // Account is a map — should show [map]
    const lines = stdout.split("\n");
    const accountLine = lines.find((l: string) => l.includes("Account"));
    expect(accountLine).toBeDefined();
    expect(accountLine).toContain("[map]");
    // Number is a plain — should NOT show [map]
    const numberLine = lines.find((l: string) => l.includes("Number") && !l.includes("Block"));
    expect(numberLine).toBeDefined();
    expect(numberLine).not.toContain("[map]");
  });

  test("query.System.Account --help shows storage help with --dump but not --limit", async () => {
    const { stdout, exitCode } = await runCli(["query.System.Account", "--help"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("(Storage)");
    expect(stdout).toContain("Type:");
    expect(stdout).toContain("Usage:");
    expect(stdout).toContain("--dump");
    expect(stdout).not.toContain("--limit");
  });

  test("keyless map query without --dump shows help instead of fetching entries", async () => {
    const { stdout, exitCode } = await runCli(["query.System.Account"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("(Storage)");
    expect(stdout).toContain("Usage:");
    expect(stdout).toContain("--dump");
    expect(stdout).toContain("Hint:");
  }, 15_000);

  test("unknown pallet in query listing suggests alternatives", async () => {
    const { stderr, exitCode } = await runCli(["query.Systm"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("System");
  });

  test("dot query.System.Number executes query via dot-path", async () => {
    const { stdout, exitCode } = await runCli(["query.System.Number"]);
    expect(exitCode).toBe(0);
    // Should return a numeric block number
    expect(stdout).toBeTruthy();
  }, 15_000);

  // --json output tests
  test("query --json lists pallets with storage counts", async () => {
    const { stdout, exitCode } = await runCli(["query", "--json"]);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.chain).toBe("polkadot");
    expect(Array.isArray(parsed.pallets)).toBe(true);
    const system = parsed.pallets.find((p: any) => p.name === "System");
    expect(system).toBeDefined();
    expect(system.storage).toBeGreaterThan(0);
  });

  test("query.System --json lists storage items in pallet", async () => {
    const { stdout, exitCode } = await runCli(["query.System", "--json"]);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.pallet).toBe("System");
    expect(Array.isArray(parsed.storage)).toBe(true);
    const account = parsed.storage.find((s: any) => s.name === "Account");
    expect(account).toBeDefined();
    expect(account.valueType).toBeDefined();
    expect(account.keyType).toBeDefined();
  });

  test("--json flag produces valid JSON for value queries", async () => {
    const jsonFlag = await runCli(["query.System.Number", "--json"]);
    expect(jsonFlag.exitCode).toBe(0);
    // The shared isJsonOutput unit tests cover equivalence with --output json;
    // keep this subprocess test to one live RPC query so it stays reliable in CI.
    expect(() => JSON.parse(jsonFlag.stdout)).not.toThrow();
  }, 15_000);

  test("--at best is accepted and threads through to papi", async () => {
    const { exitCode, stdout } = await runCli(["query.System.Number", "--at", "best"]);
    expect(exitCode).toBe(0);
    expect(stdout).toBeTruthy();
  }, 15_000);

  test("--at with invalid value errors before hitting the network", async () => {
    const { exitCode, stderr } = await runCli(["query.System.Number", "--at", "latest"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Invalid --at");
  });

  test("--at with a 0x-hex block hash is not coerced to Number by CAC", async () => {
    // Regression: CAC/mri silently parses 0x-hex as Number and loses precision.
    // We sidestep this by reading --at from raw argv. The block hash here is
    // syntactically valid but doesn't resolve, so we just assert the parser
    // didn't reject it with "Invalid --at" (which would mean it saw a number).
    const fakeHash = `0x${"ab".repeat(32)}`;
    const { stderr } = await runCli(["query.System.Number", "--at", fakeHash]);
    expect(stderr).not.toContain("Invalid --at");
  }, 15_000);

  test("--at with a never-pinned hash produces a clean archive-endpoint hint", async () => {
    const fakeHash = `0x${"ab".repeat(32)}`;
    const { exitCode, stderr } = await runCli(["query.System.Number", "--at", fakeHash]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("archive endpoint");
    expect(stderr).toContain("--rpc wss://<archive-endpoint>");
  }, 15_000);
});

// ---------------------------------------------------------------------------
// Helper to build StorageItemInfo from metadata
// ---------------------------------------------------------------------------
function getStorageItem(palletName: string, itemName: string): StorageItemInfo {
  const pallet = meta.unified.pallets.find((p) => p.name === palletName);
  if (!pallet?.storage) throw new Error(`Pallet ${palletName} not found`);
  const item = pallet.storage.items.find((s) => s.name === itemName);
  if (!item) throw new Error(`Storage item ${palletName}.${itemName} not found`);
  return {
    name: item.name,
    docs: item.docs ?? [],
    type: item.type.tag,
    keyTypeId: item.type.tag === "map" ? item.type.value.key : null,
    valueTypeId: item.type.tag === "plain" ? item.type.value : item.type.value.value,
  };
}

// ---------------------------------------------------------------------------
// parseStorageKeys — single-hasher struct key (e.g. Hrmp.HrmpChannels)
// ---------------------------------------------------------------------------
describe("parseStorageKeys — single-hasher struct key", () => {
  const storageItem = getStorageItem("Hrmp", "HrmpChannels");

  test("composes positional args into struct", async () => {
    const result = await parseStorageKeys(meta, "Hrmp", storageItem, ["1000", "5140"]);
    expect(result).toEqual([{ sender: 1000, recipient: 5140 }]);
  });

  test("accepts single JSON arg", async () => {
    const result = await parseStorageKeys(meta, "Hrmp", storageItem, [
      '{"sender":1000,"recipient":5140}',
    ]);
    expect(result).toEqual([{ sender: 1000, recipient: 5140 }]);
  });

  test("throws on wrong arg count (3 args for 2-field struct)", async () => {
    expect(parseStorageKeys(meta, "Hrmp", storageItem, ["1000", "5140", "extra"])).rejects.toThrow(
      /takes 2 argument/,
    );
  });

  test("no args returns empty (for getEntries)", async () => {
    const result = await parseStorageKeys(meta, "Hrmp", storageItem, []);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// parseStorageKeys — single-hasher non-struct key (e.g. System.Account)
// ---------------------------------------------------------------------------
describe("parseStorageKeys — single-hasher non-struct key", () => {
  const storageItem = getStorageItem("System", "Account");

  test("parses single AccountId arg", async () => {
    const addr = "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty";
    const result = await parseStorageKeys(meta, "System", storageItem, [addr]);
    expect(result).toEqual([addr]);
  });

  test("throws on multiple args for non-struct single-hasher", async () => {
    expect(parseStorageKeys(meta, "System", storageItem, ["addr1", "addr2"])).rejects.toThrow(
      /Pass 1 argument/,
    );
  });

  test("single primitive key (BlockHash)", async () => {
    const storageItem = getStorageItem("System", "BlockHash");
    const result = await parseStorageKeys(meta, "System", storageItem, ["42"]);
    expect(result).toEqual([42]);
  });
});

// ---------------------------------------------------------------------------
// parseStorageKeys — multi-hasher NMap key (e.g. Staking.ErasStakers)
// ---------------------------------------------------------------------------
describe("parseStorageKeys — multi-hasher NMap key", () => {
  const storageItem = getStorageItem("Staking", "ErasStakers");

  test("parses era + account args (full key)", async () => {
    const addr = "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty";
    const result = await parseStorageKeys(meta, "Staking", storageItem, ["100", addr]);
    expect(result).toEqual([100, addr]);
  });

  test("partial key (1 arg for 2-key NMap) returns parsed subset", async () => {
    const result = await parseStorageKeys(meta, "Staking", storageItem, ["100"]);
    expect(result).toEqual([100]);
  });

  test("no args returns empty (for getEntries)", async () => {
    const result = await parseStorageKeys(meta, "Staking", storageItem, []);
    expect(result).toEqual([]);
  });

  test("throws on too many args", async () => {
    const addr = "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty";
    expect(parseStorageKeys(meta, "Staking", storageItem, ["100", addr, "extra"])).rejects.toThrow(
      /expects at most 2 key arg/,
    );
  });
});

// ---------------------------------------------------------------------------
// parseStorageKeys — partial key queries
// ---------------------------------------------------------------------------
describe("parseStorageKeys — partial key queries", () => {
  test("partial key returns fewer args than expected for NMap", async () => {
    const storageItem = getStorageItem("Staking", "ErasStakers");
    const result = await parseStorageKeys(meta, "Staking", storageItem, ["42"]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(42);
  });

  test("partial key types are parsed correctly", async () => {
    const storageItem = getStorageItem("Staking", "ErasStakers");
    // First key is era index (u32), should parse as number
    const result = await parseStorageKeys(meta, "Staking", storageItem, ["999"]);
    expect(result).toEqual([999]);
  });

  test("single-hasher map with no args returns empty (not partial)", async () => {
    const storageItem = getStorageItem("System", "Account");
    const result = await parseStorageKeys(meta, "System", storageItem, []);
    expect(result).toEqual([]);
  });

  test("single-hasher map with full key returns parsed key", async () => {
    const storageItem = getStorageItem("System", "BlockHash");
    const result = await parseStorageKeys(meta, "System", storageItem, ["10"]);
    expect(result).toEqual([10]);
  });
});

// ---------------------------------------------------------------------------
// parseStorageKeys — plain storage (no keys)
// ---------------------------------------------------------------------------
describe("parseStorageKeys — plain storage", () => {
  test("returns empty for plain storage with no args", async () => {
    const storageItem: StorageItemInfo = {
      name: "Number",
      docs: [],
      type: "plain",
      keyTypeId: null,
      valueTypeId: 4,
    };
    const result = await parseStorageKeys(meta, "System", storageItem, []);
    expect(result).toEqual([]);
  });
});
