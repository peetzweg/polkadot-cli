import { describe, expect, test } from "bun:test";
import { findClosest, suggestMessage } from "./fuzzy-match.ts";

describe("findClosest", () => {
  test("exact case-insensitive match", () => {
    expect(findClosest("system", ["System", "Balances"])).toEqual(["System"]);
  });

  test("single-char typo finds match", () => {
    expect(findClosest("Systm", ["System", "Balances"])).toEqual(["System"]);
  });

  test("multiple suggestions sorted by distance", () => {
    expect(findClosest("Balnce", ["Balances", "Balance", "Staking"])).toEqual([
      "Balance",
      "Balances",
    ]);
  });

  test("at most 3 suggestions returned", () => {
    const result = findClosest("ab", ["abc", "abd", "abe", "abf"]);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  test("no matches within maxDistance returns empty", () => {
    expect(findClosest("zzzzz", ["System", "Balances"])).toEqual([]);
  });

  test("custom maxDistance parameter", () => {
    expect(findClosest("Syste", ["System"], 1)).toEqual(["System"]);
  });

  test("empty candidates returns empty", () => {
    expect(findClosest("anything", [])).toEqual([]);
  });
});

describe("suggestMessage", () => {
  test('formats "Did you mean" with suggestions', () => {
    expect(suggestMessage("pallet", "Systm", ["System", "Balances"])).toBe(
      'Unknown pallet "Systm". Did you mean: System?',
    );
  });

  test("no suggestions returns Unknown message", () => {
    expect(suggestMessage("pallet", "zzzzz", ["System"])).toBe('Unknown pallet "zzzzz".');
  });

  test("exact case-insensitive match returns the name", () => {
    expect(suggestMessage("pallet", "system", ["System"])).toBe("System");
  });

  test("multiple suggestions are comma-joined", () => {
    expect(suggestMessage("constant", "Balnce", ["Balance", "Balances", "Staking"])).toBe(
      'Unknown constant "Balnce". Did you mean: Balance, Balances?',
    );
  });

  test("empty candidates returns Unknown message", () => {
    expect(suggestMessage("storage item", "foo", [])).toBe('Unknown storage item "foo".');
  });
});
