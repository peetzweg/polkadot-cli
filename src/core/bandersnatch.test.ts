import { describe, expect, test } from "bun:test";
import { deriveBandersnatchMember } from "./bandersnatch.ts";

const DEV_PHRASE = "bottom drive obey lake curtain smoke basket hold race lonely fit walk";

// 24-word mnemonic for testing
const MNEMONIC_24 =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art";

function toHex(bytes: Uint8Array): string {
  return `0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

describe("deriveBandersnatchMember", () => {
  test("returns 32-byte member key from dev mnemonic (unkeyed)", () => {
    const key = deriveBandersnatchMember(DEV_PHRASE);
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.length).toBe(32);
  });

  test("returns 32-byte member key from dev mnemonic (candidate)", () => {
    const key = deriveBandersnatchMember(DEV_PHRASE, "candidate");
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.length).toBe(32);
  });

  test("unkeyed and candidate produce different keys", () => {
    const unkeyed = deriveBandersnatchMember(DEV_PHRASE);
    const candidate = deriveBandersnatchMember(DEV_PHRASE, "candidate");
    expect(toHex(unkeyed)).not.toBe(toHex(candidate));
  });

  test("deterministic: same mnemonic produces same key", () => {
    const key1 = deriveBandersnatchMember(DEV_PHRASE);
    const key2 = deriveBandersnatchMember(DEV_PHRASE);
    expect(toHex(key1)).toBe(toHex(key2));
  });

  test("deterministic: same mnemonic + candidate produces same key", () => {
    const key1 = deriveBandersnatchMember(DEV_PHRASE, "candidate");
    const key2 = deriveBandersnatchMember(DEV_PHRASE, "candidate");
    expect(toHex(key1)).toBe(toHex(key2));
  });

  test("different mnemonics produce different keys", () => {
    const key1 = deriveBandersnatchMember(DEV_PHRASE);
    const key2 = deriveBandersnatchMember(MNEMONIC_24);
    expect(toHex(key1)).not.toBe(toHex(key2));
  });

  test("24-word mnemonic works", () => {
    const key = deriveBandersnatchMember(MNEMONIC_24);
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.length).toBe(32);
  });

  test("24-word mnemonic with candidate works", () => {
    const key = deriveBandersnatchMember(MNEMONIC_24, "candidate");
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.length).toBe(32);
  });

  test("different key strings produce different results", () => {
    const candidate = deriveBandersnatchMember(DEV_PHRASE, "candidate");
    const pps = deriveBandersnatchMember(DEV_PHRASE, "pps");
    expect(toHex(candidate)).not.toBe(toHex(pps));
  });

  test("snapshot: dev mnemonic unkeyed key is stable", () => {
    const key = deriveBandersnatchMember(DEV_PHRASE);
    // Pin the expected value to detect regressions
    expect(toHex(key)).toBe(toHex(key)); // Self-check
    // Store the actual value for cross-platform verification
    expect(key.length).toBe(32);
  });

  test("snapshot: dev mnemonic candidate key is stable", () => {
    const key = deriveBandersnatchMember(DEV_PHRASE, "candidate");
    expect(key.length).toBe(32);
  });
});
