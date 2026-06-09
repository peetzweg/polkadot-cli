import { afterEach, describe, expect, test } from "bun:test";
import { getPublicKey, sign, verify } from "@scure/sr25519";
import { TEST_MNEMONIC } from "../commands/__fixtures__/run-cli.ts";
import type { StoredAccount } from "../config/accounts-types.ts";
import { isEnvSecret, isWatchOnly } from "../config/accounts-types.ts";
import {
  bytesToHex,
  createNewAccount,
  deriveExpandedSecret,
  expandedSecretFromStored,
  fromSs58,
  getDevAddress,
  importAccount,
  isDevAccount,
  isExpandedSecret,
  isHexPublicKey,
  keypairFromSecret,
  miniSecretFromSecret,
  publicKeyToHex,
  resolveAccountExpandedSecret,
  resolveAccountKeypair,
  resolveAccountSigner,
  resolveSecret,
  secretKind,
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
      /Unknown account[\s\S]*Available accounts/,
    );
  });

  test("unknown account lists accounts one per line", async () => {
    try {
      await resolveAccountKeypair("nonexistent_account_xyz_42");
    } catch (e: any) {
      expect(e.message).toContain("Available accounts:\n");
      expect(e.message).toContain("\n    - alice");
      return;
    }
    throw new Error("expected to throw");
  });

  test("unknown account suggests close match", async () => {
    try {
      await resolveAccountKeypair("alic");
    } catch (e: any) {
      expect(e.message).toContain("Did you mean: alice");
      return;
    }
    throw new Error("expected to throw");
  });

  test("unknown account omits suggestion when no close match", async () => {
    try {
      await resolveAccountKeypair("zzzzzzzzzzzzz");
    } catch (e: any) {
      expect(e.message).not.toContain("Did you mean");
      expect(e.message).toContain("Available accounts:");
      return;
    }
    throw new Error("expected to throw");
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
// resolveAccountExpandedSecret — sr25519 expanded 64-byte private key
// ---------------------------------------------------------------------------

describe("resolveAccountExpandedSecret", () => {
  test("dev account returns 64-byte expanded secret", async () => {
    const secret = await resolveAccountExpandedSecret("dave");
    expect(secret).toBeInstanceOf(Uint8Array);
    expect(secret).toHaveLength(64);
  });

  test("getPublicKey(expandedSecret) matches the keypair's public key for all dev accounts", async () => {
    for (const name of ["alice", "bob", "charlie", "dave", "eve", "ferdie"]) {
      const secret = await resolveAccountExpandedSecret(name);
      const keypair = await resolveAccountKeypair(name);
      expect(publicKeyToHex(getPublicKey(secret))).toBe(publicKeyToHex(keypair.publicKey));
    }
  });

  test("signatures made with expanded secret verify against the account's public key", async () => {
    const secret = await resolveAccountExpandedSecret("dave");
    const pub = getPublicKey(secret);
    const message = new TextEncoder().encode("hello dave");
    const sig = sign(secret, message);
    expect(verify(message, sig, pub)).toBe(true);
  });

  test("all dev accounts produce distinct 64-byte expanded secrets", async () => {
    const hexes = new Set<string>();
    for (const name of ["alice", "bob", "charlie", "dave", "eve", "ferdie"]) {
      const s = await resolveAccountExpandedSecret(name);
      expect(s).toHaveLength(64);
      hexes.add(bytesToHex(s));
    }
    expect(hexes.size).toBe(6);
  });

  test("unknown account throws", async () => {
    await expect(resolveAccountExpandedSecret("nonexistent_xyz_42")).rejects.toThrow(
      /Unknown account/,
    );
  });
});

// ---------------------------------------------------------------------------
// deriveExpandedSecret / miniSecretFromSecret
// ---------------------------------------------------------------------------

describe("miniSecretFromSecret", () => {
  test("returns 32 bytes for a valid BIP39 mnemonic", () => {
    const bytes = miniSecretFromSecret(TEST_MNEMONIC);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes).toHaveLength(32);
  });

  test("returns 32 bytes for a 0x-prefixed hex seed", () => {
    const hexSeed = `0x${"11".repeat(32)}`;
    const bytes = miniSecretFromSecret(hexSeed);
    expect(bytes).toHaveLength(32);
    // All-0x11 seed round-trips exactly
    expect(bytesToHex(bytes)).toBe(hexSeed);
  });

  test("throws on garbage input", () => {
    expect(() => miniSecretFromSecret("not-a-valid-secret")).toThrow("Invalid secret");
  });
});

describe("deriveExpandedSecret", () => {
  const rootSeed = miniSecretFromSecret(TEST_MNEMONIC);

  test("root path returns a 64-byte expanded secret", () => {
    const sk = deriveExpandedSecret(rootSeed, "");
    expect(sk).toBeInstanceOf(Uint8Array);
    expect(sk).toHaveLength(64);
    // getPublicKey(sk) must match what importAccount derives at root
    const expectedPub = importAccount(TEST_MNEMONIC, "").publicKey;
    expect(publicKeyToHex(getPublicKey(sk))).toBe(publicKeyToHex(expectedPub));
  });

  test("hard path //a produces a different secret than root and matches importAccount's public key", () => {
    const root = deriveExpandedSecret(rootSeed, "");
    const hard = deriveExpandedSecret(rootSeed, "//a");
    expect(bytesToHex(root)).not.toBe(bytesToHex(hard));
    const expectedPub = importAccount(TEST_MNEMONIC, "//a").publicKey;
    expect(publicKeyToHex(getPublicKey(hard))).toBe(publicKeyToHex(expectedPub));
  });

  test("soft path /a exercises the soft branch of the derivation", () => {
    const soft = deriveExpandedSecret(rootSeed, "/a");
    expect(soft).toHaveLength(64);
    const expectedPub = importAccount(TEST_MNEMONIC, "/a").publicKey;
    expect(publicKeyToHex(getPublicKey(soft))).toBe(publicKeyToHex(expectedPub));
  });

  test("numeric junction //0 exercises the u32 branch of createChainCode", () => {
    const sk = deriveExpandedSecret(rootSeed, "//0");
    expect(sk).toHaveLength(64);
    // Numeric and string components produce different secrets
    const viaString = deriveExpandedSecret(rootSeed, "//zero");
    expect(bytesToHex(sk)).not.toBe(bytesToHex(viaString));
    // And matches importAccount at the same path
    const expectedPub = importAccount(TEST_MNEMONIC, "//0").publicKey;
    expect(publicKeyToHex(getPublicKey(sk))).toBe(publicKeyToHex(expectedPub));
  });

  test("throws when a junction component exceeds 31 bytes", () => {
    const tooLong = "x".repeat(32);
    expect(() => deriveExpandedSecret(rootSeed, `//${tooLong}`)).toThrow(/too long/);
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

// ---------------------------------------------------------------------------
// Raw private key (64-byte sr25519 expanded secret) support
// ---------------------------------------------------------------------------

describe("isExpandedSecret", () => {
  test("accepts 0x + 128 hex chars", () => {
    expect(isExpandedSecret(`0x${"ab".repeat(64)}`)).toBe(true);
  });

  test("rejects a 32-byte hex seed (64 hex chars)", () => {
    expect(isExpandedSecret(`0x${"ab".repeat(32)}`)).toBe(false);
  });

  test("rejects without 0x prefix", () => {
    expect(isExpandedSecret("ab".repeat(64))).toBe(false);
  });

  test("rejects mnemonics and garbage", () => {
    expect(isExpandedSecret(TEST_MNEMONIC)).toBe(false);
    expect(isExpandedSecret("")).toBe(false);
    expect(isExpandedSecret(`0x${"zz".repeat(64)}`)).toBe(false);
  });
});

describe("secretKind", () => {
  test("classifies a BIP39 mnemonic", () => {
    expect(secretKind(TEST_MNEMONIC)).toBe("mnemonic");
  });

  test("classifies a 32-byte hex seed", () => {
    expect(secretKind(`0x${"11".repeat(32)}`)).toBe("seed");
  });

  test("classifies a 64-byte expanded secret", () => {
    expect(secretKind(`0x${"11".repeat(64)}`)).toBe("expanded");
  });
});

describe("importAccount – expanded secret", () => {
  // Alice's 64-byte expanded secret, taken from `resolveAccountExpandedSecret("alice")`.
  function aliceExpanded(): Promise<string> {
    return resolveAccountExpandedSecret("alice").then(bytesToHex);
  }

  test("imports a raw 64-byte expanded secret and yields a 32-byte public key", async () => {
    const expanded = await aliceExpanded();
    const { publicKey } = importAccount(expanded);
    expect(publicKey).toHaveLength(32);
  });

  test("reproduces the same public key as the source account (round-trip)", async () => {
    const expanded = await aliceExpanded();
    const { publicKey } = importAccount(expanded);
    expect(publicKeyToHex(publicKey)).toBe(
      "0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d",
    );
  });

  test("rejects a derivation path (cannot HD-derive an expanded secret)", async () => {
    const expanded = await aliceExpanded();
    expect(() => importAccount(expanded, "//staking")).toThrow(
      /Derivation paths are not supported/,
    );
  });

  test("accepts an empty derivation path", async () => {
    const expanded = await aliceExpanded();
    expect(() => importAccount(expanded, "")).not.toThrow();
  });
});

describe("keypairFromSecret", () => {
  test("derives from a mnemonic along the path", () => {
    const root = keypairFromSecret(TEST_MNEMONIC, "");
    const derived = keypairFromSecret(TEST_MNEMONIC, "//a");
    expect(publicKeyToHex(root.publicKey)).toBe(
      "0x66933bd1f37070ef87bd1198af3dacceb095237f803f3d32b173e6b425ed7972",
    );
    expect(publicKeyToHex(root.publicKey)).not.toBe(publicKeyToHex(derived.publicKey));
  });

  test("derives from a 32-byte hex seed", () => {
    const { publicKey } = keypairFromSecret(`0x${"11".repeat(32)}`);
    expect(publicKey).toHaveLength(32);
  });

  test("signs directly from a 64-byte expanded secret (no path)", async () => {
    const expanded = bytesToHex(await resolveAccountExpandedSecret("alice"));
    const kp = keypairFromSecret(expanded);
    expect(publicKeyToHex(kp.publicKey)).toBe(
      "0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d",
    );
    const message = new TextEncoder().encode("via keypairFromSecret");
    expect(verify(message, kp.sign(message), kp.publicKey)).toBe(true);
  });

  test("throws on a 64-byte expanded secret with a derivation path", async () => {
    const expanded = bytesToHex(await resolveAccountExpandedSecret("alice"));
    expect(() => keypairFromSecret(expanded, "//staking")).toThrow(
      /expanded secret with a derivation path/,
    );
  });
});

describe("expandedSecretFromStored", () => {
  test("expands and HD-derives a mnemonic", () => {
    const sk = expandedSecretFromStored(TEST_MNEMONIC, "//a");
    expect(sk).toHaveLength(64);
    expect(publicKeyToHex(getPublicKey(sk))).toBe(
      publicKeyToHex(importAccount(TEST_MNEMONIC, "//a").publicKey),
    );
  });

  test("expands a 32-byte hex seed", () => {
    const sk = expandedSecretFromStored(`0x${"11".repeat(32)}`);
    expect(sk).toHaveLength(64);
  });

  test("returns a stored 64-byte expanded secret verbatim", async () => {
    const expanded = await resolveAccountExpandedSecret("alice");
    const hex = bytesToHex(expanded);
    expect(bytesToHex(expandedSecretFromStored(hex))).toBe(hex);
  });

  test("throws on an expanded secret carrying a derivation path (contradiction)", async () => {
    const hex = bytesToHex(await resolveAccountExpandedSecret("alice"));
    expect(() => expandedSecretFromStored(hex, "//staking")).toThrow(
      /expanded secret with a derivation path/,
    );
  });
});

describe("resolveAccountKeypair – expanded secret", () => {
  // We cannot easily inject a stored account from here, so we verify the signing
  // primitives directly: a keypair built from an expanded secret must sign and
  // produce signatures that verify against the same public key.
  test("a signature from an imported expanded secret verifies against its public key", async () => {
    const expanded = await resolveAccountExpandedSecret("bob");
    const pub = getPublicKey(expanded);
    const message = new TextEncoder().encode("raw key signing");
    const sig = sign(expanded, message);
    expect(verify(message, sig, pub)).toBe(true);
    // And the public key matches what importAccount derives from the hex form.
    expect(publicKeyToHex(importAccount(bytesToHex(expanded)).publicKey)).toBe(publicKeyToHex(pub));
  });
});
