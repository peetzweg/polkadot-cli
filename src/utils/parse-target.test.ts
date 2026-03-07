import { describe, expect, test } from "bun:test";
import { parseTarget, resolveTargetChain } from "./parse-target.ts";

describe("parseTarget (default, item required)", () => {
  test("2-segment returns pallet and item", () => {
    expect(parseTarget("System.Account")).toEqual({ pallet: "System", item: "Account" });
  });

  test("3-segment returns chain, pallet, and item", () => {
    expect(parseTarget("kusama.System.Account")).toEqual({
      chain: "kusama",
      pallet: "System",
      item: "Account",
    });
  });

  test("1-segment throws", () => {
    expect(() => parseTarget("System")).toThrow(/Expected format/);
  });

  test("4-segment throws", () => {
    expect(() => parseTarget("a.b.c.d")).toThrow(/Expected format/);
  });

  test("3-segment with empty parts throws", () => {
    expect(() => parseTarget(".System.Account")).toThrow(/Expected format/);
    expect(() => parseTarget("kusama..Account")).toThrow(/Expected format/);
    expect(() => parseTarget("kusama.System.")).toThrow(/Expected format/);
  });

  test("2-segment with empty parts throws", () => {
    expect(() => parseTarget(".Account")).toThrow(/Expected format/);
    expect(() => parseTarget("System.")).toThrow(/Expected format/);
  });

  test("3-segment preserves user casing for chain prefix", () => {
    expect(parseTarget("Polkadot.System.Account")).toEqual({
      chain: "Polkadot",
      pallet: "System",
      item: "Account",
    });
  });
});

describe("parseTarget (allowPalletOnly)", () => {
  const knownChains = ["kusama", "westend", "polkadot"];

  test("1-segment returns pallet only", () => {
    expect(parseTarget("System", { allowPalletOnly: true })).toEqual({ pallet: "System" });
  });

  test("2-segment with known chain returns chain + pallet", () => {
    expect(parseTarget("kusama.System", { knownChains, allowPalletOnly: true })).toEqual({
      chain: "kusama",
      pallet: "System",
    });
  });

  test("2-segment with unknown first segment returns pallet + item", () => {
    expect(parseTarget("System.Account", { knownChains, allowPalletOnly: true })).toEqual({
      pallet: "System",
      item: "Account",
    });
  });

  test("2-segment chain match is case-insensitive", () => {
    expect(parseTarget("Kusama.System", { knownChains, allowPalletOnly: true })).toEqual({
      chain: "Kusama",
      pallet: "System",
    });
  });

  test("3-segment returns chain + pallet + item", () => {
    expect(parseTarget("kusama.System.Account", { knownChains, allowPalletOnly: true })).toEqual({
      chain: "kusama",
      pallet: "System",
      item: "Account",
    });
  });

  test("4-segment throws", () => {
    expect(() => parseTarget("a.b.c.d", { allowPalletOnly: true })).toThrow(/Expected format/);
  });

  test("empty 1-segment throws", () => {
    expect(() => parseTarget("", { allowPalletOnly: true })).toThrow(/Expected format/);
  });
});

describe("resolveTargetChain", () => {
  test("prefix only returns prefix", () => {
    expect(resolveTargetChain({ pallet: "System", chain: "kusama" })).toBe("kusama");
  });

  test("flag only returns flag", () => {
    expect(resolveTargetChain({ pallet: "System" }, "westend")).toBe("westend");
  });

  test("neither returns undefined", () => {
    expect(resolveTargetChain({ pallet: "System" })).toBeUndefined();
  });

  test("both prefix and flag throws", () => {
    expect(() => resolveTargetChain({ pallet: "System", chain: "kusama" }, "westend")).toThrow(
      /Chain specified both as prefix/,
    );
  });
});
