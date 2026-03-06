import { afterEach, describe, expect, test } from "bun:test";
import { TEST_MNEMONIC } from "../commands/__fixtures__/run-cli.ts";
import { isEnvSecret } from "../config/accounts-types.ts";
import {
  createNewAccount,
  getDevAddress,
  importAccount,
  isDevAccount,
  publicKeyToHex,
  resolveSecret,
  toSs58,
  tryDerivePublicKey,
} from "./accounts.ts";

describe("isDevAccount", () => {
  test("recognizes all 6 dev names", () => {
    for (const name of ["alice", "bob", "charlie", "dave", "eve", "ferdie"]) {
      expect(isDevAccount(name)).toBe(true);
    }
  });

  test("is case-insensitive", () => {
    expect(isDevAccount("Alice")).toBe(true);
    expect(isDevAccount("ALICE")).toBe(true);
    expect(isDevAccount("BoB")).toBe(true);
  });

  test("rejects non-dev names", () => {
    expect(isDevAccount("mallory")).toBe(false);
    expect(isDevAccount("")).toBe(false);
    expect(isDevAccount("alicee")).toBe(false);
  });
});

describe("publicKeyToHex", () => {
  test("formats bytes as 0x-prefixed hex", () => {
    expect(publicKeyToHex(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))).toBe("0xdeadbeef");
  });

  test("handles empty input", () => {
    expect(publicKeyToHex(new Uint8Array([]))).toBe("0x");
  });
});

describe("toSs58", () => {
  test("encodes Uint8Array to ss58 address", () => {
    const { publicKey } = importAccount(TEST_MNEMONIC);
    expect(toSs58(publicKey)).toBe("5EPCUjPxiHAcNooYipQFWr9NmmXJKpNG5RhcntXwbtUySrgH");
  });

  test("encodes 0x-prefixed hex string", () => {
    const hex = "0x66933bd1f37070ef87bd1198af3dacceb095237f803f3d32b173e6b425ed7972";
    expect(toSs58(hex)).toBe("5EPCUjPxiHAcNooYipQFWr9NmmXJKpNG5RhcntXwbtUySrgH");
  });

  test("encodes hex string without 0x prefix", () => {
    const hex = "66933bd1f37070ef87bd1198af3dacceb095237f803f3d32b173e6b425ed7972";
    expect(toSs58(hex)).toBe("5EPCUjPxiHAcNooYipQFWr9NmmXJKpNG5RhcntXwbtUySrgH");
  });

  test("supports custom SS58 prefix", () => {
    const { publicKey } = importAccount(TEST_MNEMONIC);
    const polkadotAddr = toSs58(publicKey, 0);
    // prefix=0 produces a different address starting with '1'
    expect(polkadotAddr).not.toBe(toSs58(publicKey));
    expect(polkadotAddr).toMatch(/^1/);
  });
});

describe("getDevAddress", () => {
  test("returns known alice address", () => {
    expect(getDevAddress("alice")).toBe("5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY");
  });

  test("different accounts produce different addresses", () => {
    expect(getDevAddress("alice")).not.toBe(getDevAddress("bob"));
    expect(getDevAddress("bob")).toBe("5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty");
  });

  test("is case-insensitive", () => {
    expect(getDevAddress("alice")).toBe(getDevAddress("Alice"));
    expect(getDevAddress("alice")).toBe(getDevAddress("ALICE"));
  });
});

describe("importAccount", () => {
  test("imports valid hex seed", () => {
    const hexSeed = `0x${"11".repeat(32)}`;
    const { publicKey } = importAccount(hexSeed);
    expect(publicKey).toBeInstanceOf(Uint8Array);
    expect(publicKey).toHaveLength(32);
  });

  test("imports valid mnemonic", () => {
    const { publicKey } = importAccount(TEST_MNEMONIC);
    expect(publicKey).toBeInstanceOf(Uint8Array);
    expect(publicKey).toHaveLength(32);
    expect(publicKeyToHex(publicKey)).toBe(
      "0x66933bd1f37070ef87bd1198af3dacceb095237f803f3d32b173e6b425ed7972",
    );
  });

  test("throws on invalid input", () => {
    expect(() => importAccount("not-a-valid-secret")).toThrow("Invalid secret");
  });

  test("throws on hex seed without 0x prefix", () => {
    const bareHex = "11".repeat(32);
    expect(() => importAccount(bareHex)).toThrow("Invalid secret");
  });
});

describe("createNewAccount", () => {
  test("returns mnemonic and 32-byte public key", () => {
    const { mnemonic, publicKey } = createNewAccount();
    expect(typeof mnemonic).toBe("string");
    expect(mnemonic.split(" ").length).toBeGreaterThanOrEqual(12);
    expect(publicKey).toBeInstanceOf(Uint8Array);
    expect(publicKey).toHaveLength(32);
  });

  test("produces different results on successive calls", () => {
    const a = createNewAccount();
    const b = createNewAccount();
    expect(publicKeyToHex(a.publicKey)).not.toBe(publicKeyToHex(b.publicKey));
    expect(a.mnemonic).not.toBe(b.mnemonic);
  });
});

describe("isEnvSecret", () => {
  test("returns true for EnvSecret objects", () => {
    expect(isEnvSecret({ env: "MY_VAR" })).toBe(true);
  });

  test("returns false for plain strings", () => {
    expect(isEnvSecret("some-mnemonic")).toBe(false);
    expect(isEnvSecret("")).toBe(false);
  });
});

describe("resolveSecret", () => {
  const ENV_KEY = "__TEST_RESOLVE_SECRET__";

  afterEach(() => {
    delete process.env[ENV_KEY];
  });

  test("returns plain string as-is", () => {
    expect(resolveSecret("my-mnemonic")).toBe("my-mnemonic");
  });

  test("reads env var for EnvSecret", () => {
    process.env[ENV_KEY] = TEST_MNEMONIC;
    expect(resolveSecret({ env: ENV_KEY })).toBe(TEST_MNEMONIC);
  });

  test("throws when env var is not set", () => {
    expect(() => resolveSecret({ env: ENV_KEY })).toThrow("is not set");
  });

  test("throws when env var is empty string", () => {
    process.env[ENV_KEY] = "";
    expect(() => resolveSecret({ env: ENV_KEY })).toThrow("is not set");
  });
});

describe("tryDerivePublicKey", () => {
  const ENV_KEY = "__TEST_DERIVE_PUB__";

  afterEach(() => {
    delete process.env[ENV_KEY];
  });

  test("returns null when env var is not set", () => {
    expect(tryDerivePublicKey(ENV_KEY)).toBeNull();
  });

  test("returns hex public key for valid mnemonic", () => {
    process.env[ENV_KEY] = TEST_MNEMONIC;
    const result = tryDerivePublicKey(ENV_KEY);
    expect(result).toBe("0x66933bd1f37070ef87bd1198af3dacceb095237f803f3d32b173e6b425ed7972");
  });

  test("returns null for invalid secret", () => {
    process.env[ENV_KEY] = "not a valid mnemonic at all";
    expect(tryDerivePublicKey(ENV_KEY)).toBeNull();
  });

  test("returns hex public key for valid hex seed", () => {
    const hexSeed = `0x${"11".repeat(32)}`;
    process.env[ENV_KEY] = hexSeed;
    const result = tryDerivePublicKey(ENV_KEY);
    expect(result).toMatch(/^0x[0-9a-f]{64}$/);
  });
});
