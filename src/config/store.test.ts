import { describe, expect, test } from "bun:test";
import { findChainName, resolveChain } from "./store.ts";
import type { Config } from "./types.ts";

const config: Config = {
  defaultChain: "polkadot",
  chains: {
    polkadot: { rpc: "wss://rpc.polkadot.io" },
    kusama: { rpc: "wss://kusama-rpc.polkadot.io" },
  },
};

describe("resolveChain", () => {
  test("returns default chain when no flag provided", () => {
    const result = resolveChain(config);
    expect(result).toEqual({
      name: "polkadot",
      chain: { rpc: "wss://rpc.polkadot.io" },
    });
  });

  test("returns the flagged chain when flag is provided", () => {
    const result = resolveChain(config, "kusama");
    expect(result).toEqual({
      name: "kusama",
      chain: { rpc: "wss://kusama-rpc.polkadot.io" },
    });
  });

  test("throws with descriptive error for unknown chain name", () => {
    expect(() => resolveChain(config, "westend")).toThrow(
      'Unknown chain "westend". Available chains: polkadot, kusama',
    );
  });

  test("throws for unknown chain when flag overrides valid default", () => {
    const cfg: Config = {
      defaultChain: "polkadot",
      chains: { polkadot: { rpc: "wss://rpc.polkadot.io" } },
    };
    expect(() => resolveChain(cfg, "noexist")).toThrow(
      'Unknown chain "noexist". Available chains: polkadot',
    );
  });

  test("resolves chain name case-insensitively", () => {
    const result = resolveChain(config, "Polkadot");
    expect(result).toEqual({
      name: "polkadot",
      chain: { rpc: "wss://rpc.polkadot.io" },
    });
  });

  test("resolves chain name with all-caps", () => {
    const result = resolveChain(config, "KUSAMA");
    expect(result).toEqual({
      name: "kusama",
      chain: { rpc: "wss://kusama-rpc.polkadot.io" },
    });
  });
});

describe("findChainName", () => {
  test("returns exact match when casing matches", () => {
    expect(findChainName(config, "polkadot")).toBe("polkadot");
  });

  test("returns config key for case-insensitive match", () => {
    expect(findChainName(config, "Polkadot")).toBe("polkadot");
    expect(findChainName(config, "KUSAMA")).toBe("kusama");
  });

  test("returns undefined for unknown chain", () => {
    expect(findChainName(config, "westend")).toBeUndefined();
  });
});
