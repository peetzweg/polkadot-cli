import { describe, expect, test } from "bun:test";
import { parseDotPath } from "./parse-dot-path.ts";

const knownChains = ["polkadot", "kusama", "paseo", "polkadot-asset-hub"];

describe("parseDotPath", () => {
  // --- 1 segment: category only ---
  test("query → category only", () => {
    expect(parseDotPath("query", knownChains)).toEqual({ category: "query" });
  });

  test("tx → category only", () => {
    expect(parseDotPath("tx", knownChains)).toEqual({ category: "tx" });
  });

  test("const → category only", () => {
    expect(parseDotPath("const", knownChains)).toEqual({ category: "const" });
  });

  test("events → category only", () => {
    expect(parseDotPath("events", knownChains)).toEqual({ category: "events" });
  });

  test("errors → category only", () => {
    expect(parseDotPath("errors", knownChains)).toEqual({ category: "errors" });
  });

  // --- Category aliases ---
  test("consts → const alias", () => {
    expect(parseDotPath("consts", knownChains)).toEqual({ category: "const" });
  });

  test("constants → const alias", () => {
    expect(parseDotPath("constants", knownChains)).toEqual({ category: "const" });
  });

  test("event → events alias", () => {
    expect(parseDotPath("event", knownChains)).toEqual({ category: "events" });
  });

  test("error → errors alias", () => {
    expect(parseDotPath("error", knownChains)).toEqual({ category: "errors" });
  });

  // --- 2 segments: category.Pallet ---
  test("query.System → category + pallet", () => {
    expect(parseDotPath("query.System", knownChains)).toEqual({
      category: "query",
      pallet: "System",
    });
  });

  test("tx.Balances → category + pallet", () => {
    expect(parseDotPath("tx.Balances", knownChains)).toEqual({
      category: "tx",
      pallet: "Balances",
    });
  });

  test("const.System → category + pallet", () => {
    expect(parseDotPath("const.System", knownChains)).toEqual({
      category: "const",
      pallet: "System",
    });
  });

  // --- 2 segments: Chain.category ---
  test("polkadot.query → chain + category", () => {
    expect(parseDotPath("polkadot.query", knownChains)).toEqual({
      chain: "polkadot",
      category: "query",
    });
  });

  test("Polkadot.tx → case-insensitive chain + category", () => {
    expect(parseDotPath("Polkadot.tx", knownChains)).toEqual({
      chain: "Polkadot",
      category: "tx",
    });
  });

  // --- Category takes priority over chain ---
  test("category takes priority over chain for first segment", () => {
    // If "query" were also a chain name, category should still win
    expect(parseDotPath("query.System", ["query", "polkadot"])).toEqual({
      category: "query",
      pallet: "System",
    });
  });

  // --- 3 segments: category.Pallet.Item ---
  test("query.System.Account → category + pallet + item", () => {
    expect(parseDotPath("query.System.Account", knownChains)).toEqual({
      category: "query",
      pallet: "System",
      item: "Account",
    });
  });

  test("tx.Balances.transfer_keep_alive → category + pallet + item", () => {
    expect(parseDotPath("tx.Balances.transfer_keep_alive", knownChains)).toEqual({
      category: "tx",
      pallet: "Balances",
      item: "transfer_keep_alive",
    });
  });

  test("const.System.SS58Prefix → category + pallet + item", () => {
    expect(parseDotPath("const.System.SS58Prefix", knownChains)).toEqual({
      category: "const",
      pallet: "System",
      item: "SS58Prefix",
    });
  });

  test("events.Balances.Transfer → category + pallet + item", () => {
    expect(parseDotPath("events.Balances.Transfer", knownChains)).toEqual({
      category: "events",
      pallet: "Balances",
      item: "Transfer",
    });
  });

  test("errors.System.InsufficientBalance → category + pallet + item", () => {
    expect(parseDotPath("errors.System.InsufficientBalance", knownChains)).toEqual({
      category: "errors",
      pallet: "System",
      item: "InsufficientBalance",
    });
  });

  // --- 3 segments: Chain.category.Pallet ---
  test("polkadot.query.System → chain + category + pallet", () => {
    expect(parseDotPath("polkadot.query.System", knownChains)).toEqual({
      chain: "polkadot",
      category: "query",
      pallet: "System",
    });
  });

  test("kusama.tx.Balances → chain + category + pallet", () => {
    expect(parseDotPath("kusama.tx.Balances", knownChains)).toEqual({
      chain: "kusama",
      category: "tx",
      pallet: "Balances",
    });
  });

  // --- 4 segments: Chain.category.Pallet.Item ---
  test("polkadot.query.System.Account → full path", () => {
    expect(parseDotPath("polkadot.query.System.Account", knownChains)).toEqual({
      chain: "polkadot",
      category: "query",
      pallet: "System",
      item: "Account",
    });
  });

  test("Polkadot.events.Balances.Transfer → case-insensitive chain", () => {
    expect(parseDotPath("Polkadot.events.Balances.Transfer", knownChains)).toEqual({
      chain: "Polkadot",
      category: "events",
      pallet: "Balances",
      item: "Transfer",
    });
  });

  // --- Special case: raw hex tx ---
  test("tx.0xHEX → category + pallet (hex stored as pallet)", () => {
    expect(parseDotPath("tx.0x0001076465616462656566", knownChains)).toEqual({
      category: "tx",
      pallet: "0x0001076465616462656566",
    });
  });

  // --- Error cases ---
  test("unknown single segment throws", () => {
    expect(() => parseDotPath("foo", knownChains)).toThrow(/Unknown command/);
  });

  test("unknown chain in 2 segments throws", () => {
    expect(() => parseDotPath("foo.bar", knownChains)).toThrow(/Unknown command/);
  });

  test("unknown chain in 4 segments throws", () => {
    expect(() => parseDotPath("unknown.query.System.Account", knownChains)).toThrow(
      /Unknown command/,
    );
  });

  test("5 segments throws", () => {
    expect(() => parseDotPath("a.b.c.d.e", knownChains)).toThrow(/Too many segments/);
  });

  // --- Case insensitivity for categories ---
  test("QUERY → case-insensitive category", () => {
    expect(parseDotPath("QUERY", knownChains)).toEqual({ category: "query" });
  });

  test("TX.System.remark → case-insensitive category", () => {
    expect(parseDotPath("TX.System.remark", knownChains)).toEqual({
      category: "tx",
      pallet: "System",
      item: "remark",
    });
  });

  // --- Hyphenated chain names ---
  test("polkadot-asset-hub.query → hyphenated chain name (not split on dots)", () => {
    // Note: "polkadot-asset-hub" has no dots, so it works with split on "."
    // The user would type: polkadot-asset-hub.query.System
    expect(parseDotPath("polkadot-asset-hub.query.System", knownChains)).toEqual({
      chain: "polkadot-asset-hub",
      category: "query",
      pallet: "System",
    });
  });
});
