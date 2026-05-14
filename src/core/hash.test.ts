import { describe, expect, test } from "bun:test";
import { computeHash, getAlgorithmNames, isValidAlgorithm, parseInputData, toHex } from "./hash.ts";

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
    expect(isValidAlgorithm("twox64")).toBe(true);
    expect(isValidAlgorithm("twox128")).toBe(true);
    expect(isValidAlgorithm("twox256")).toBe(true);
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
    expect(names).toContain("twox64");
    expect(names).toContain("twox128");
    expect(names).toContain("twox256");
    expect(names).toHaveLength(7);
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

  test("twox64 outputs 8 bytes", () => {
    expect(computeHash("twox64", empty)).toHaveLength(8);
  });

  test("twox128 outputs 16 bytes", () => {
    expect(computeHash("twox128", empty)).toHaveLength(16);
  });

  test("twox256 outputs 32 bytes", () => {
    expect(computeHash("twox256", empty)).toHaveLength(32);
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

  test("twox64 canonical XXH64 vector (Nobody inspects the spammish repetition)", () => {
    const hash = toHex(
      computeHash("twox64", new TextEncoder().encode("Nobody inspects the spammish repetition")),
    );
    expect(hash).toBe("0xf18b378a3ca8cefb");
  });

  test("twox128 of pallet 'System' matches Substrate prefix", () => {
    const hash = toHex(computeHash("twox128", new TextEncoder().encode("System")));
    expect(hash).toBe("0x26aa394eea5630e07c48ae0c9558cef7");
  });

  test("twox128 of pallet 'Sudo' matches Substrate prefix", () => {
    const hash = toHex(computeHash("twox128", new TextEncoder().encode("Sudo")));
    expect(hash).toBe("0x5c0d1176a568c1f92944340dbfed9e9c");
  });

  test("twox128 of pallet 'Balances' matches Substrate prefix", () => {
    const hash = toHex(computeHash("twox128", new TextEncoder().encode("Balances")));
    expect(hash).toBe("0xc2261276cc9d1f8598ea4b6a74b15c2f");
  });

  test("twox256 of empty input", () => {
    const hash = toHex(computeHash("twox256", new Uint8Array([])));
    expect(hash).toBe("0x99e9d85137db46ef4bbea33613baafd56f963c64b1f3685a4eb4abd67ff6203a");
  });
});
