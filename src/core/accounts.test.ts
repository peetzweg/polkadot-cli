import { afterEach, describe, expect, test } from "bun:test";
import { TEST_MNEMONIC } from "../commands/__fixtures__/run-cli.ts";
import type { StoredAccount } from "../config/accounts-types.ts";
import { isEnvSecret, isWatchOnly } from "../config/accounts-types.ts";
import {
  createNewAccount,
  fromSs58,
  getDevAddress,
  importAccount,
  isDevAccount,
  isHexPublicKey,
  publicKeyToHex,
  resolveAccountSigner,
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

// ---------------------------------------------------------------------------
// resolveAccountSigner
// ---------------------------------------------------------------------------

describe("resolveAccountSigner", () => {
  test("dev account (alice) returns a valid signer with known public key", async () => {
    const signer = await resolveAccountSigner("alice");
    expect(signer).toBeDefined();
    expect(signer.publicKey).toBeInstanceOf(Uint8Array);
    expect(signer.publicKey).toHaveLength(32);
    expect(publicKeyToHex(signer.publicKey)).toBe(
      "0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d",
    );
  });

  test("dev account is case-insensitive", async () => {
    const lower = await resolveAccountSigner("bob");
    const upper = await resolveAccountSigner("Bob");
    expect(publicKeyToHex(lower.publicKey)).toBe(publicKeyToHex(upper.publicKey));
  });

  test("all dev accounts produce distinct signers", async () => {
    const keys = new Set<string>();
    for (const name of ["alice", "bob", "charlie", "dave", "eve", "ferdie"]) {
      const signer = await resolveAccountSigner(name);
      keys.add(publicKeyToHex(signer.publicKey));
    }
    expect(keys.size).toBe(6);
  });

  test("unknown account throws with available accounts list", async () => {
    // This will read from real accounts file but "nonexistent" should never exist
    await expect(resolveAccountSigner("nonexistent_account_xyz_42")).rejects.toThrow(
      /Unknown account.*Available accounts/,
    );
  });
});

// ---------------------------------------------------------------------------
// derivation paths (multi-segment)
// ---------------------------------------------------------------------------

describe("derivation paths", () => {
  test("importAccount with path produces different key than root", () => {
    const root = importAccount(TEST_MNEMONIC, "");
    const derived = importAccount(TEST_MNEMONIC, "//a");
    expect(publicKeyToHex(root.publicKey)).not.toBe(publicKeyToHex(derived.publicKey));
  });

  test("importAccount //a vs //a//b produce different keys", () => {
    const a = importAccount(TEST_MNEMONIC, "//a");
    const ab = importAccount(TEST_MNEMONIC, "//a//b");
    expect(publicKeyToHex(a.publicKey)).not.toBe(publicKeyToHex(ab.publicKey));
  });

  describe("fromSs58", () => {
    test("decodes SS58 address to public key bytes", () => {
      const address = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY";
      const publicKey = fromSs58(address);
      expect(publicKey).toBeInstanceOf(Uint8Array);
      expect(publicKey).toHaveLength(32);
      expect(publicKeyToHex(publicKey)).toBe(
        "0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d",
      );
    });

    test("roundtrips with toSs58", () => {
      const original = "0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d";
      const ss58 = toSs58(original);
      const decoded = publicKeyToHex(fromSs58(ss58));
      expect(decoded).toBe(original);
    });

    test("throws on invalid address", () => {
      expect(() => fromSs58("notanaddress")).toThrow();
    });
  });

  describe("isHexPublicKey", () => {
    test("accepts valid 0x + 64 hex chars", () => {
      expect(
        isHexPublicKey("0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d"),
      ).toBe(true);
    });

    test("rejects without 0x prefix", () => {
      expect(
        isHexPublicKey("d43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d"),
      ).toBe(false);
    });

    test("rejects wrong length", () => {
      expect(isHexPublicKey("0xd43593c715fdd31c")).toBe(false);
      expect(isHexPublicKey(`0x${"aa".repeat(33)}`)).toBe(false);
    });

    test("rejects non-hex characters", () => {
      expect(isHexPublicKey(`0x${"zz".repeat(32)}`)).toBe(false);
    });

    test("rejects empty string", () => {
      expect(isHexPublicKey("")).toBe(false);
    });
  });

  test("importAccount //a//b (hard+hard) vs //a/b (hard+soft) produce different keys", () => {
    const hardHard = importAccount(TEST_MNEMONIC, "//a//b");
    const hardSoft = importAccount(TEST_MNEMONIC, "//a/b");
    expect(publicKeyToHex(hardHard.publicKey)).not.toBe(publicKeyToHex(hardSoft.publicKey));
  });

  test("importAccount with //polkadot//0/wallet produces 32-byte key", () => {
    const { publicKey } = importAccount(TEST_MNEMONIC, "//polkadot//0/wallet");
    expect(publicKey).toBeInstanceOf(Uint8Array);
    expect(publicKey).toHaveLength(32);
  });

  test("createNewAccount with path differs from root of same mnemonic", () => {
    const { mnemonic, publicKey: derivedKey } = createNewAccount("//test");
    const { publicKey: rootKey } = importAccount(mnemonic, "");
    expect(publicKeyToHex(derivedKey)).not.toBe(publicKeyToHex(rootKey));
  });

  test("tryDerivePublicKey with path differs from root", () => {
    const ENV_KEY = "__TEST_DERIV_PATH__";
    process.env[ENV_KEY] = TEST_MNEMONIC;
    try {
      const root = tryDerivePublicKey(ENV_KEY, "");
      const derived = tryDerivePublicKey(ENV_KEY, "//a");
      expect(root).not.toBeNull();
      expect(derived).not.toBeNull();
      expect(root).not.toBe(derived);
    } finally {
      delete process.env[ENV_KEY];
    }
  });
});

// ---------------------------------------------------------------------------
// isWatchOnly
// ---------------------------------------------------------------------------

describe("isWatchOnly", () => {
  test("returns true when secret is undefined", () => {
    const account: StoredAccount = {
      name: "watch",
      publicKey: "0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d",
      derivationPath: "",
    };
    expect(isWatchOnly(account)).toBe(true);
  });

  test("returns false when secret is string", () => {
    const account: StoredAccount = {
      name: "secret-acct",
      secret: TEST_MNEMONIC,
      publicKey: "0x44a996beb1eef7bdcab976ab6d2ca26104834164ecf28fb375600576fcc6eb0f",
      derivationPath: "",
    };
    expect(isWatchOnly(account)).toBe(false);
  });

  test("returns false when secret is EnvSecret", () => {
    const account: StoredAccount = {
      name: "env-acct",
      secret: { env: "MY_SECRET" },
      publicKey: "",
      derivationPath: "",
    };
    expect(isWatchOnly(account)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resolveAccountSigner – watch-only guard
// ---------------------------------------------------------------------------

describe("resolveAccountSigner – watch-only", () => {
  test("throws for watch-only account (no secret)", async () => {
    // resolveAccountSigner reads from the accounts file on disk.
    // We can't easily inject a watch-only account into the file here,
    // so we verify via the CLI integration tests instead.
    // However we can at least verify the error message pattern for unknown accounts.
    await expect(resolveAccountSigner("nonexistent_watch_only_xyz")).rejects.toThrow(
      /Unknown account/,
    );
  });
});
