import { describe, expect, test } from "bun:test";
import {
  fingerprintsMatch,
  isRuntimeFingerprint,
  type RuntimeFingerprint,
} from "./runtime-fingerprint.ts";

const base: RuntimeFingerprint = {
  specName: "polkadot",
  specVersion: 1018,
  transactionVersion: 24,
  implName: "parity-polkadot",
  implVersion: 0,
  authoringVersion: 0,
  codeHash: "0xaaaa",
  fetchedAt: "2026-04-27T12:00:00Z",
};

describe("fingerprintsMatch", () => {
  test("identical fingerprints match", () => {
    expect(fingerprintsMatch(base, { ...base })).toBe(true);
  });

  test("different specVersion does not match", () => {
    expect(fingerprintsMatch(base, { ...base, specVersion: 1019 })).toBe(false);
  });

  test("different transactionVersion does not match", () => {
    expect(fingerprintsMatch(base, { ...base, transactionVersion: 25 })).toBe(false);
  });

  test("different codeHash does not match (local-restart-with-new-wasm-same-spec)", () => {
    expect(fingerprintsMatch(base, { ...base, codeHash: "0xbbbb" })).toBe(false);
  });

  test("different fetchedAt is ignored", () => {
    expect(fingerprintsMatch(base, { ...base, fetchedAt: "2030-01-01T00:00:00Z" })).toBe(true);
  });

  test("different implVersion is ignored (operator info, not staleness)", () => {
    expect(fingerprintsMatch(base, { ...base, implVersion: 7 })).toBe(true);
  });
});

describe("isRuntimeFingerprint", () => {
  test("accepts a well-formed object", () => {
    expect(isRuntimeFingerprint(base)).toBe(true);
  });

  test("rejects when codeHash is missing", () => {
    const { codeHash, ...rest } = base;
    expect(isRuntimeFingerprint(rest)).toBe(false);
  });

  test("rejects when specVersion is a string", () => {
    expect(isRuntimeFingerprint({ ...base, specVersion: "1018" })).toBe(false);
  });

  test("rejects null and primitives", () => {
    expect(isRuntimeFingerprint(null)).toBe(false);
    expect(isRuntimeFingerprint(undefined)).toBe(false);
    expect(isRuntimeFingerprint("nope")).toBe(false);
    expect(isRuntimeFingerprint(42)).toBe(false);
  });
});
