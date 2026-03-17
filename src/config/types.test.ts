import { describe, expect, test } from "bun:test";
import { BUILTIN_CHAIN_NAMES, DEFAULT_CONFIG, primaryRpc } from "./types.ts";
import { hasLightClientSpec } from "../core/client.ts";

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
    }
  });

  test("known light-client chains have empty rpc arrays", () => {
    for (const [name, config] of Object.entries(DEFAULT_CONFIG.chains)) {
      if (hasLightClientSpec(name)) {
        expect((config.rpc as string[]).length).toBe(0);
      }
    }
  });

  test("RPC-only chains have at least 2 RPC endpoints", () => {
    for (const [name, config] of Object.entries(DEFAULT_CONFIG.chains)) {
      if (!hasLightClientSpec(name)) {
        expect((config.rpc as string[]).length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  test("RPC-only chains use wss:// protocol", () => {
    for (const [name, config] of Object.entries(DEFAULT_CONFIG.chains)) {
      if (!hasLightClientSpec(name)) {
        const rpcs = Array.isArray(config.rpc) ? config.rpc : [config.rpc];
        for (const url of rpcs) {
          expect(url).toMatch(/^wss:\/\//);
        }
      }
    }
  });

  test("BUILTIN_CHAIN_NAMES matches DEFAULT_CONFIG keys", () => {
    const configKeys = new Set(Object.keys(DEFAULT_CONFIG.chains));
    expect(BUILTIN_CHAIN_NAMES).toEqual(configKeys);
  });

  test("includes all Polkadot system parachains", () => {
    const expected = [
      "polkadot",
      "polkadot-asset-hub",
      "polkadot-bridge-hub",
      "polkadot-collectives",
      "polkadot-coretime",
      "polkadot-people",
    ];
    for (const name of expected) {
      expect(BUILTIN_CHAIN_NAMES.has(name)).toBe(true);
    }
  });

  test("includes all Paseo system parachains", () => {
    const expected = [
      "paseo",
      "paseo-asset-hub",
      "paseo-bridge-hub",
      "paseo-collectives",
      "paseo-coretime",
      "paseo-people",
    ];
    for (const name of expected) {
      expect(BUILTIN_CHAIN_NAMES.has(name)).toBe(true);
    }
  });

  test("paseo-bridge-hub has RPCs (no light client spec)", () => {
    const rpcs = DEFAULT_CONFIG.chains["paseo-bridge-hub"]!.rpc as string[];
    expect(rpcs.length).toBeGreaterThanOrEqual(2);
    expect(rpcs[0]).toContain("bridge-hub-paseo");
  });

  test("paseo-collectives has RPCs (no light client spec)", () => {
    const rpcs = DEFAULT_CONFIG.chains["paseo-collectives"]!.rpc as string[];
    expect(rpcs.length).toBeGreaterThanOrEqual(2);
    expect(rpcs[0]).toContain("collectives-paseo");
  });

  test("polkadot has empty rpc array (uses light client)", () => {
    expect(DEFAULT_CONFIG.chains.polkadot!.rpc).toEqual([]);
  });

  test("paseo has empty rpc array (uses light client)", () => {
    expect(DEFAULT_CONFIG.chains.paseo!.rpc).toEqual([]);
  });

  test("all parachains have empty rpc if they have light client spec", () => {
    const parachains = [
      "polkadot-asset-hub",
      "polkadot-bridge-hub",
      "polkadot-collectives",
      "polkadot-coretime",
      "polkadot-people",
      "paseo-asset-hub",
      "paseo-coretime",
      "paseo-people",
    ];
    for (const name of parachains) {
      if (hasLightClientSpec(name)) {
        expect((DEFAULT_CONFIG.chains[name]!.rpc as string[]).length).toBe(0);
      }
    }
  });

  test("primaryRpc returns undefined for empty array", () => {
    expect(primaryRpc([])).toBeUndefined();
  });
});
