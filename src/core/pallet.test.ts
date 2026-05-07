import { describe, expect, test } from "bun:test";
import { publicKeyToHex, toSs58 } from "./accounts.ts";
import { derivePalletAccount, formatPalletId, parsePalletId } from "./pallet.ts";

describe("derivePalletAccount", () => {
  test("Treasury (py/trsry)", () => {
    const account = derivePalletAccount(parsePalletId("py/trsry"));
    expect(account).toHaveLength(32);
    // "modl" prefix (0x6d6f646c) + "py/trsry" (0x70792f7472737279) + 20 zero bytes
    expect(publicKeyToHex(account)).toBe(
      "0x6d6f646c70792f74727372790000000000000000000000000000000000000000",
    );
  });

  test("Bounties (py/bount)", () => {
    const account = derivePalletAccount(parsePalletId("py/bount"));
    expect(publicKeyToHex(account)).toBe(
      "0x6d6f646c70792f626f756e740000000000000000000000000000000000000000",
    );
  });

  test("Society (py/socie)", () => {
    const account = derivePalletAccount(parsePalletId("py/socie"));
    expect(publicKeyToHex(account)).toBe(
      "0x6d6f646c70792f736f6369650000000000000000000000000000000000000000",
    );
  });

  test("Crowdloan (py/cfund)", () => {
    const account = derivePalletAccount(parsePalletId("py/cfund"));
    expect(publicKeyToHex(account)).toBe(
      "0x6d6f646c70792f6366756e640000000000000000000000000000000000000000",
    );
  });

  test("hex input matches ASCII input", () => {
    const fromAscii = derivePalletAccount(parsePalletId("py/trsry"));
    const fromHex = derivePalletAccount(parsePalletId("0x70792f7472737279"));
    expect(publicKeyToHex(fromAscii)).toBe(publicKeyToHex(fromHex));
  });

  test("all-zero PalletId", () => {
    const account = derivePalletAccount(new Uint8Array(8));
    expect(publicKeyToHex(account)).toBe(
      "0x6d6f646c00000000000000000000000000000000000000000000000000000000",
    );
  });

  test("output is always 32 bytes", () => {
    for (const id of ["py/trsry", "py/bount", "py/socie", "\x00\x00\x00\x00\x00\x00\x00\x00"]) {
      expect(derivePalletAccount(parsePalletId(id))).toHaveLength(32);
    }
  });

  test("different PalletIds produce different accounts", () => {
    const a = derivePalletAccount(parsePalletId("py/trsry"));
    const b = derivePalletAccount(parsePalletId("py/bount"));
    expect(publicKeyToHex(a)).not.toBe(publicKeyToHex(b));
  });

  test("produces valid SS58 address (prefix 42)", () => {
    const account = derivePalletAccount(parsePalletId("py/trsry"));
    const ss58 = toSs58(account);
    expect(ss58).toMatch(/^5/);
    expect(ss58.length).toBeGreaterThan(40);
  });

  test("rejects PalletId of wrong length", () => {
    expect(() => derivePalletAccount(new Uint8Array(7))).toThrow(/8 bytes/);
    expect(() => derivePalletAccount(new Uint8Array(9))).toThrow(/8 bytes/);
    expect(() => derivePalletAccount(new Uint8Array(0))).toThrow(/8 bytes/);
  });
});

describe("parsePalletId", () => {
  test("accepts 8-character ASCII", () => {
    const bytes = parsePalletId("py/trsry");
    expect(bytes).toEqual(new Uint8Array([0x70, 0x79, 0x2f, 0x74, 0x72, 0x73, 0x72, 0x79]));
  });

  test("accepts 0x-prefixed hex", () => {
    const bytes = parsePalletId("0x70792f7472737279");
    expect(bytes).toEqual(new Uint8Array([0x70, 0x79, 0x2f, 0x74, 0x72, 0x73, 0x72, 0x79]));
  });

  test("accepts 0X-prefixed hex (uppercase)", () => {
    const bytes = parsePalletId("0X70792F7472737279");
    expect(bytes).toEqual(new Uint8Array([0x70, 0x79, 0x2f, 0x74, 0x72, 0x73, 0x72, 0x79]));
  });

  test("rejects 7-character ASCII", () => {
    expect(() => parsePalletId("py/trsr")).toThrow(/8 ASCII characters or 0x-prefixed hex/);
  });

  test("rejects 9-character ASCII", () => {
    expect(() => parsePalletId("py/trsryy")).toThrow(/8 ASCII characters or 0x-prefixed hex/);
  });

  test("rejects empty input", () => {
    expect(() => parsePalletId("")).toThrow(/8 ASCII characters or 0x-prefixed hex/);
  });

  test("rejects hex of wrong length", () => {
    expect(() => parsePalletId("0x70792f74727372")).toThrow(/16 hex characters/);
    expect(() => parsePalletId("0x70792f747273727900")).toThrow(/16 hex characters/);
    expect(() => parsePalletId("0x")).toThrow(/16 hex characters/);
  });

  test("rejects hex with non-hex characters", () => {
    expect(() => parsePalletId("0xZZ792f7472737279")).toThrow(/non-hex characters/);
  });

  test("rejects non-ASCII bytes in 8-character form", () => {
    // 8 characters but one is non-ASCII (é = U+00E9)
    expect(() => parsePalletId("py/trsré")).toThrow(/ASCII bytes/);
  });
});

describe("formatPalletId", () => {
  test("formats printable ASCII as ASCII", () => {
    expect(formatPalletId(parsePalletId("py/trsry"))).toBe("py/trsry");
  });

  test("formats non-printable bytes as hex", () => {
    expect(formatPalletId(new Uint8Array(8))).toBe("0x0000000000000000");
  });

  test("formats partially non-printable as hex", () => {
    const bytes = new Uint8Array([0x70, 0x79, 0x2f, 0x74, 0x72, 0x73, 0x72, 0x00]);
    expect(formatPalletId(bytes)).toBe("0x70792f7472737200");
  });
});
