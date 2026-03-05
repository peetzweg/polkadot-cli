import { describe, expect, test } from "bun:test";
import { resolveChain } from "./store.ts";
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
});
