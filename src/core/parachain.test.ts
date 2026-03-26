import { describe, expect, test } from "bun:test";
import { publicKeyToHex, toSs58 } from "./accounts.ts";
import { deriveSovereignAccount, isValidParaId } from "./parachain.ts";

describe("deriveSovereignAccount", () => {
  test("child account for para ID 1000", () => {
    const account = deriveSovereignAccount(1000, "child");
    expect(account).toHaveLength(32);
    // "para" prefix (0x70617261) + 1000 as LE u32 (0xe8030000) + 24 zero bytes
    expect(publicKeyToHex(account)).toBe(
      "0x70617261e8030000000000000000000000000000000000000000000000000000",
    );
  });

  test("sibling account for para ID 1000", () => {
    const account = deriveSovereignAccount(1000, "sibling");
    expect(account).toHaveLength(32);
    // "sibl" prefix (0x7369626c) + 1000 as LE u32 (0xe8030000) + 24 zero bytes
    expect(publicKeyToHex(account)).toBe(
      "0x7369626ce8030000000000000000000000000000000000000000000000000000",
    );
  });

  test("child account for para ID 2004", () => {
    const account = deriveSovereignAccount(2004, "child");
    // 2004 = 0x07D4 → LE u32 = d4070000
    expect(publicKeyToHex(account)).toBe(
      "0x70617261d4070000000000000000000000000000000000000000000000000000",
    );
  });

  test("sibling account for para ID 2004", () => {
    const account = deriveSovereignAccount(2004, "sibling");
    expect(publicKeyToHex(account)).toBe(
      "0x7369626cd4070000000000000000000000000000000000000000000000000000",
    );
  });

  test("para ID 0 (edge case)", () => {
    const account = deriveSovereignAccount(0, "child");
    expect(publicKeyToHex(account)).toBe(
      "0x7061726100000000000000000000000000000000000000000000000000000000",
    );
  });

  test("max u32 para ID (4294967295)", () => {
    const account = deriveSovereignAccount(0xffffffff, "child");
    // 0xFFFFFFFF LE = ffffffff
    expect(publicKeyToHex(account)).toBe(
      "0x70617261ffffffff000000000000000000000000000000000000000000000000",
    );
  });

  test("output is always 32 bytes", () => {
    for (const paraId of [0, 1, 1000, 2004, 65535, 100000, 0xffffffff]) {
      for (const type of ["child", "sibling"] as const) {
        expect(deriveSovereignAccount(paraId, type)).toHaveLength(32);
      }
    }
  });

  test("child and sibling for same para ID differ", () => {
    const child = deriveSovereignAccount(1000, "child");
    const sibling = deriveSovereignAccount(1000, "sibling");
    expect(publicKeyToHex(child)).not.toBe(publicKeyToHex(sibling));
  });

  test("different para IDs produce different accounts", () => {
    const a = deriveSovereignAccount(1000, "child");
    const b = deriveSovereignAccount(2000, "child");
    expect(publicKeyToHex(a)).not.toBe(publicKeyToHex(b));
  });

  test("produces valid SS58 address", () => {
    const account = deriveSovereignAccount(1000, "child");
    const ss58 = toSs58(account);
    expect(ss58).toMatch(/^5/); // prefix 42 starts with 5
    expect(ss58.length).toBeGreaterThan(40);
  });
});

describe("isValidParaId", () => {
  test("accepts valid values", () => {
    expect(isValidParaId(0)).toBe(true);
    expect(isValidParaId(1)).toBe(true);
    expect(isValidParaId(1000)).toBe(true);
    expect(isValidParaId(65535)).toBe(true);
    expect(isValidParaId(0xffffffff)).toBe(true);
  });

  test("rejects negative", () => {
    expect(isValidParaId(-1)).toBe(false);
  });

  test("rejects float", () => {
    expect(isValidParaId(1.5)).toBe(false);
  });

  test("rejects NaN", () => {
    expect(isValidParaId(NaN)).toBe(false);
  });

  test("rejects values exceeding u32", () => {
    expect(isValidParaId(0x100000000)).toBe(false);
  });
});
