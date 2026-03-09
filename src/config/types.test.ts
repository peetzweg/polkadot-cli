import { describe, expect, test } from "bun:test";
import { BUILTIN_CHAIN_NAMES, DEFAULT_CONFIG, primaryRpc } from "./types.ts";

describe("primaryRpc", () => {
  test("returns the string itself when given a string", () => {
    expect(primaryRpc("wss://rpc.polkadot.io")).toBe("wss://rpc.polkadot.io");
  });

  test("returns first element when given an array", () => {
    expect(primaryRpc(["wss://a", "wss://b", "wss://c"])).toBe("wss://a");
  });

  test("returns single element from single-element array", () => {
    expect(primaryRpc(["wss://only"])).toBe("wss://only");
  });

  test("returns empty string when given empty string", () => {
    expect(primaryRpc("")).toBe("");
  });
});

describe("DEFAULT_CONFIG", () => {
  test("built-in chains use array rpc", () => {
    for (const [_name, config] of Object.entries(DEFAULT_CONFIG.chains)) {
      expect(Array.isArray(config.rpc)).toBe(true);
      expect((config.rpc as string[]).length).toBeGreaterThanOrEqual(1);
    }
  });

  test("polkadot has multiple RPC endpoints", () => {
    const rpcs = DEFAULT_CONFIG.chains.polkadot!.rpc;
    expect(Array.isArray(rpcs)).toBe(true);
    expect((rpcs as string[]).length).toBeGreaterThanOrEqual(2);
  });

  test("primaryRpc works with DEFAULT_CONFIG chains", () => {
    const primary = primaryRpc(DEFAULT_CONFIG.chains.polkadot!.rpc);
    expect(primary).toBe("wss://rpc.polkadot.io");
  });

  test("BUILTIN_CHAIN_NAMES matches DEFAULT_CONFIG keys", () => {
    const configKeys = new Set(Object.keys(DEFAULT_CONFIG.chains));
    expect(BUILTIN_CHAIN_NAMES).toEqual(configKeys);
  });
});
