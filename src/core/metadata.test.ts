import { describe, expect, test } from "bun:test";
import { getTestMetadata } from "../commands/__fixtures__/load-metadata.ts";
import {
  describeType,
  findPallet,
  getPalletNames,
  getSignedExtensions,
  type Lookup,
  listPallets,
  type MetadataBundle,
} from "./metadata.ts";

const meta: MetadataBundle = getTestMetadata();

// ---------------------------------------------------------------------------
// Helper: scan the lookup table to find type IDs matching a given predicate
// ---------------------------------------------------------------------------
function findTypeId(
  lookup: Lookup,
  predicate: (entry: any) => boolean,
  maxScan = 500,
): number | undefined {
  for (let id = 0; id < maxScan; id++) {
    try {
      const entry = lookup(id);
      if (predicate(entry)) return id;
    } catch {
      // skip invalid IDs
    }
  }
  return undefined;
}

// Pre-discover type IDs we need for describeType tests
const primitiveTypeId = findTypeId(
  meta.lookup,
  (e) => e.type === "primitive" && e.value === "u32",
)!;
const accountIdTypeId = findTypeId(meta.lookup, (e) => e.type === "AccountId32")!;
const smallEnumTypeId = findTypeId(
  meta.lookup,
  (e) => e.type === "enum" && Object.keys(e.value).length > 0 && Object.keys(e.value).length <= 4,
)!;
const largeEnumTypeId = findTypeId(
  meta.lookup,
  (e) => e.type === "enum" && Object.keys(e.value).length > 4,
)!;
const sequenceTypeId = findTypeId(meta.lookup, (e) => e.type === "sequence")!;
const optionTypeId = findTypeId(meta.lookup, (e) => e.type === "option")!;

// ---------------------------------------------------------------------------
// getPalletNames
// ---------------------------------------------------------------------------
describe("getPalletNames", () => {
  test("returns non-empty array", () => {
    const names = getPalletNames(meta);
    expect(names.length).toBeGreaterThan(0);
  });

  test("contains known pallets: System, Balances, Staking", () => {
    const names = getPalletNames(meta);
    expect(names).toContain("System");
    expect(names).toContain("Balances");
    expect(names).toContain("Staking");
  });
});

// ---------------------------------------------------------------------------
// findPallet
// ---------------------------------------------------------------------------
describe("findPallet", () => {
  test("exact name match returns PalletInfo", () => {
    const pallet = findPallet(meta, "System");
    expect(pallet).toBeDefined();
    expect(pallet!.name).toBe("System");
  });

  test("case-insensitive match", () => {
    const pallet = findPallet(meta, "system");
    expect(pallet).toBeDefined();
    expect(pallet!.name).toBe("System");
  });

  test("returns undefined for unknown pallet name", () => {
    expect(findPallet(meta, "NonExistentPallet")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// listPallets
// ---------------------------------------------------------------------------
describe("listPallets", () => {
  test("returns array of PalletInfo objects with expected shape", () => {
    const pallets = listPallets(meta);
    expect(pallets.length).toBeGreaterThan(0);
    for (const p of pallets) {
      expect(typeof p.name).toBe("string");
      expect(typeof p.index).toBe("number");
      expect(Array.isArray(p.docs)).toBe(true);
      expect(Array.isArray(p.storage)).toBe(true);
      expect(Array.isArray(p.constants)).toBe(true);
      expect(Array.isArray(p.calls)).toBe(true);
    }
  });

  test("System pallet has Account storage item", () => {
    const pallets = listPallets(meta);
    const system = pallets.find((p) => p.name === "System")!;
    const account = system.storage.find((s) => s.name === "Account");
    expect(account).toBeDefined();
  });

  test("storage items have correct type ('plain' or 'map')", () => {
    const pallets = listPallets(meta);
    const allStorage = pallets.flatMap((p) => p.storage);
    expect(allStorage.length).toBeGreaterThan(0);
    for (const s of allStorage) {
      expect(["plain", "map"]).toContain(s.type);
    }
  });
});

// ---------------------------------------------------------------------------
// describeType
// ---------------------------------------------------------------------------
describe("describeType", () => {
  test("formats a primitive type (u32)", () => {
    expect(primitiveTypeId).toBeDefined();
    expect(describeType(meta.lookup, primitiveTypeId)).toBe("u32");
  });

  test("formats AccountId32", () => {
    expect(accountIdTypeId).toBeDefined();
    expect(describeType(meta.lookup, accountIdTypeId)).toBe("AccountId32");
  });

  test("formats small enum (≤4 variants) as pipe-separated", () => {
    expect(smallEnumTypeId).toBeDefined();
    const result = describeType(meta.lookup, smallEnumTypeId);
    expect(result).toContain(" | ");
    // At most 4 variants → at most 3 pipes
    expect(result.split(" | ").length).toBeLessThanOrEqual(4);
  });

  test("formats large enum (>4 variants) as enum(N variants)", () => {
    expect(largeEnumTypeId).toBeDefined();
    const result = describeType(meta.lookup, largeEnumTypeId);
    expect(result).toMatch(/^enum\(\d+ variants\)$/);
  });

  test("fallback for invalid typeId returns type(<id>)", () => {
    expect(describeType(meta.lookup, 999999)).toBe("type(999999)");
  });

  test("formats Vec type", () => {
    expect(sequenceTypeId).toBeDefined();
    expect(describeType(meta.lookup, sequenceTypeId)).toMatch(/^Vec<.+>$/);
  });

  test("formats Option type", () => {
    expect(optionTypeId).toBeDefined();
    expect(describeType(meta.lookup, optionTypeId)).toMatch(/^Option<.+>$/);
  });
});

// ---------------------------------------------------------------------------
// getSignedExtensions
// ---------------------------------------------------------------------------
describe("getSignedExtensions", () => {
  test("returns non-empty array", () => {
    const exts = getSignedExtensions(meta);
    expect(exts.length).toBeGreaterThan(0);
  });

  test("contains CheckMortality extension", () => {
    const exts = getSignedExtensions(meta);
    const names = exts.map((e) => e.identifier);
    expect(names).toContain("CheckMortality");
  });

  test("each extension has identifier, type, additionalSigned fields", () => {
    const exts = getSignedExtensions(meta);
    for (const ext of exts) {
      expect(typeof ext.identifier).toBe("string");
      expect(typeof ext.type).toBe("number");
      expect(typeof ext.additionalSigned).toBe("number");
    }
  });
});
