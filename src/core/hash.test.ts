import { test, expect, describe } from "bun:test";
import {
  ALGORITHMS,
  computeHash,
  getAlgorithmNames,
  isValidAlgorithm,
  parseInputData,
  toHex,
} from "./hash.ts";

describe("toHex", () => {
  test("formats bytes as 0x-prefixed hex", () => {
    expect(toHex(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))).toBe("0xdeadbeef");
  });

  test("handles empty input", () => {
    expect(toHex(new Uint8Array([]))).toBe("0x");
  });
});

describe("parseInputData", () => {
  test("decodes 0x-prefixed hex to bytes", () => {
    const result = parseInputData("0xdeadbeef");
    expect(result).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
  });

  test("encodes plain text as UTF-8", () => {
    const result = parseInputData("hello");
    expect(result).toEqual(new TextEncoder().encode("hello"));
  });

  test("rejects odd-length hex", () => {
    expect(() => parseInputData("0xabc")).toThrow("odd number of characters");
  });

  test("handles empty hex 0x", () => {
    const result = parseInputData("0x");
    expect(result).toEqual(new Uint8Array([]));
  });
});

describe("isValidAlgorithm", () => {
  test("returns true for valid algorithms", () => {
    expect(isValidAlgorithm("blake2b256")).toBe(true);
    expect(isValidAlgorithm("blake2b128")).toBe(true);
    expect(isValidAlgorithm("keccak256")).toBe(true);
    expect(isValidAlgorithm("sha256")).toBe(true);
  });

  test("returns false for invalid algorithms", () => {
    expect(isValidAlgorithm("md5")).toBe(false);
    expect(isValidAlgorithm("")).toBe(false);
    expect(isValidAlgorithm("BLAKE2B256")).toBe(false);
  });
});

describe("getAlgorithmNames", () => {
  test("returns all algorithm names", () => {
    const names = getAlgorithmNames();
    expect(names).toContain("blake2b256");
    expect(names).toContain("blake2b128");
    expect(names).toContain("keccak256");
    expect(names).toContain("sha256");
    expect(names).toHaveLength(4);
  });
});

describe("output lengths", () => {
  const empty = new Uint8Array([]);

  test("blake2b256 outputs 32 bytes", () => {
    expect(computeHash("blake2b256", empty)).toHaveLength(32);
  });

  test("blake2b128 outputs 16 bytes", () => {
    expect(computeHash("blake2b128", empty)).toHaveLength(16);
  });

  test("keccak256 outputs 32 bytes", () => {
    expect(computeHash("keccak256", empty)).toHaveLength(32);
  });

  test("sha256 outputs 32 bytes", () => {
    expect(computeHash("sha256", empty)).toHaveLength(32);
  });
});

describe("known test vectors", () => {
  test("sha256 of empty input", () => {
    const hash = toHex(computeHash("sha256", new Uint8Array([])));
    expect(hash).toBe("0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  test("sha256 of 'hello'", () => {
    const hash = toHex(computeHash("sha256", new TextEncoder().encode("hello")));
    expect(hash).toBe("0x2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });

  test("keccak256 of empty input", () => {
    const hash = toHex(computeHash("keccak256", new Uint8Array([])));
    expect(hash).toBe("0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470");
  });

  test("keccak256 of 'hello'", () => {
    const hash = toHex(computeHash("keccak256", new TextEncoder().encode("hello")));
    expect(hash).toBe("0x1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8");
  });

  test("blake2b256 of empty input", () => {
    const hash = toHex(computeHash("blake2b256", new Uint8Array([])));
    expect(hash).toBe("0x0e5751c026e543b2e8ab2eb06099daa1d1e5df47778f7787faab45cdf12fe3a8");
  });

  test("blake2b128 of empty input", () => {
    const hash = toHex(computeHash("blake2b128", new Uint8Array([])));
    expect(hash).toBe("0xcae66941d9efbd404e4d88758ea67670");
  });
});
