import { describe, expect, test } from "bun:test";
import type { StorageItemInfo } from "../core/metadata.ts";
import { getTestMetadata } from "./__fixtures__/load-metadata.ts";
import { runCli } from "./__fixtures__/run-cli.ts";
import { parseStorageKeys } from "./query.ts";

const meta = getTestMetadata();

describe("dot query", () => {
  test("no target shows help", async () => {
    const { stdout, exitCode } = await runCli(["query"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Usage: dot query");
  });

  test("chain prefix works (3-segment)", async () => {
    const { stdout, exitCode } = await runCli(["query", "polkadot.System.Number"]);
    expect(exitCode).toBe(0);
    expect(stdout).toBeTruthy();
  });

  test("stdout does not contain chain info prefix", async () => {
    const { stdout, exitCode } = await runCli(["query", "polkadot.System.Number"]);
    expect(exitCode).toBe(0);
    expect(stdout).not.toContain("chain:");
    expect(stdout).not.toContain("chain: polkadot");
  });

  test("json output is valid JSON with no extra text", async () => {
    const { stdout, exitCode } = await runCli([
      "query",
      "polkadot.System.Number",
      "--output",
      "json",
    ]);
    expect(exitCode).toBe(0);
    expect(() => JSON.parse(stdout)).not.toThrow();
  });

  test("chain prefix + --chain flag errors", async () => {
    const { stderr, exitCode } = await runCli([
      "query",
      "polkadot.System.Number",
      "--chain",
      "polkadot",
    ]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Chain specified both as prefix");
  });

  test("case-insensitive chain prefix resolves correctly", async () => {
    const { stdout, exitCode } = await runCli(["query", "Polkadot.System.Number"]);
    expect(exitCode).toBe(0);
    expect(stdout).toBeTruthy();
  });

  test("case-insensitive --chain flag resolves correctly", async () => {
    const { stdout, exitCode } = await runCli(["query", "System.Number", "--chain", "POLKADOT"]);
    expect(exitCode).toBe(0);
    expect(stdout).toBeTruthy();
  });

  test("json output has no progress messages on stdout", async () => {
    const { stdout, exitCode } = await runCli(["query", "System.Number", "--output", "json"]);
    expect(exitCode).toBe(0);
    expect(stdout).not.toContain("Fetching metadata");
    expect(stdout).not.toContain("Connecting");
    expect(() => JSON.parse(stdout)).not.toThrow();
  });
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

  test("composes positional args into struct", () => {
    const result = parseStorageKeys(meta, "Hrmp", storageItem, ["1000", "5140"]);
    expect(result).toEqual([{ sender: 1000, recipient: 5140 }]);
  });

  test("accepts single JSON arg", () => {
    const result = parseStorageKeys(meta, "Hrmp", storageItem, [
      '{"sender":1000,"recipient":5140}',
    ]);
    expect(result).toEqual([{ sender: 1000, recipient: 5140 }]);
  });

  test("throws on wrong arg count (3 args for 2-field struct)", () => {
    expect(() => parseStorageKeys(meta, "Hrmp", storageItem, ["1000", "5140", "extra"])).toThrow(
      /takes 2 argument/,
    );
  });

  test("no args returns empty (for getEntries)", () => {
    const result = parseStorageKeys(meta, "Hrmp", storageItem, []);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// parseStorageKeys — single-hasher non-struct key (e.g. System.Account)
// ---------------------------------------------------------------------------
describe("parseStorageKeys — single-hasher non-struct key", () => {
  const storageItem = getStorageItem("System", "Account");

  test("parses single AccountId arg", () => {
    const addr = "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty";
    const result = parseStorageKeys(meta, "System", storageItem, [addr]);
    expect(result).toEqual([addr]);
  });

  test("throws on multiple args for non-struct single-hasher", () => {
    expect(() => parseStorageKeys(meta, "System", storageItem, ["addr1", "addr2"])).toThrow(
      /Pass 1 argument/,
    );
  });

  test("single primitive key (BlockHash)", () => {
    const storageItem = getStorageItem("System", "BlockHash");
    const result = parseStorageKeys(meta, "System", storageItem, ["42"]);
    expect(result).toEqual([42]);
  });
});

// ---------------------------------------------------------------------------
// parseStorageKeys — multi-hasher NMap key (e.g. Staking.ErasStakers)
// ---------------------------------------------------------------------------
describe("parseStorageKeys — multi-hasher NMap key", () => {
  const storageItem = getStorageItem("Staking", "ErasStakers");

  test("parses era + account args", () => {
    const addr = "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty";
    const result = parseStorageKeys(meta, "Staking", storageItem, ["100", addr]);
    expect(result).toEqual([100, addr]);
  });

  test("throws on wrong arg count (1 arg for 2-key NMap)", () => {
    expect(() => parseStorageKeys(meta, "Staking", storageItem, ["100"])).toThrow(
      /expects 2 key arg/,
    );
  });

  test("throws on too many args", () => {
    const addr = "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty";
    expect(() => parseStorageKeys(meta, "Staking", storageItem, ["100", addr, "extra"])).toThrow(
      /expects 2 key arg/,
    );
  });
});

// ---------------------------------------------------------------------------
// parseStorageKeys — plain storage (no keys)
// ---------------------------------------------------------------------------
describe("parseStorageKeys — plain storage", () => {
  test("returns empty for plain storage with no args", () => {
    const storageItem: StorageItemInfo = {
      name: "Number",
      docs: [],
      type: "plain",
      keyTypeId: null,
      valueTypeId: 4,
    };
    const result = parseStorageKeys(meta, "System", storageItem, []);
    expect(result).toEqual([]);
  });
});
