import { expect, test } from "bun:test";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import {
  accountIdToH160,
  h160FromHex,
  h160ToFallbackAccountId,
  isH160Hex,
  toEip55,
} from "./h160.ts";

const ALICE_ACCOUNT_ID = "d43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d";
const ALICE_H160_EIP55 = "0x9621DDe636dE098B43Efb0fA9b61fAcFE328F99D";

test("accountIdToH160: Alice routes through keccak fallback", () => {
  const h160 = accountIdToH160(hexToBytes(ALICE_ACCOUNT_ID));
  expect(toEip55(h160)).toBe(ALICE_H160_EIP55);
});

test("accountIdToH160: eth-derived suffix strips trailing 0xEE*12", () => {
  const h160 = hexToBytes("aabbccddeeff00112233445566778899aabbccdd");
  const fallback = h160ToFallbackAccountId(h160);
  const recovered = accountIdToH160(fallback);
  expect(bytesToHex(recovered)).toBe(bytesToHex(h160));
});

test("accountIdToH160: rejects non-32-byte input", () => {
  expect(() => accountIdToH160(new Uint8Array(31))).toThrow();
  expect(() => accountIdToH160(new Uint8Array(33))).toThrow();
});

test("h160ToFallbackAccountId: appends 12 bytes of 0xEE", () => {
  const h160 = hexToBytes("0102030405060708090a0b0c0d0e0f1011121314");
  const fallback = h160ToFallbackAccountId(h160);
  expect(fallback.length).toBe(32);
  expect(bytesToHex(fallback.slice(0, 20))).toBe(bytesToHex(h160));
  for (let i = 20; i < 32; i++) {
    expect(fallback[i]).toBe(0xee);
  }
});

test("h160ToFallbackAccountId: rejects non-20-byte input", () => {
  expect(() => h160ToFallbackAccountId(new Uint8Array(19))).toThrow();
  expect(() => h160ToFallbackAccountId(new Uint8Array(21))).toThrow();
});

// EIP-55 canonical vectors (https://eips.ethereum.org/EIPS/eip-55)
test.each([
  ["5aaeb6053f3e94c9b9a09f33669435e7ef1beaed", "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed"],
  ["fb6916095ca1df60bb79ce92ce3ea74c37c5d359", "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359"],
  ["dbf03b407c01e7cd3cbea99509d93f8dddc8c6fb", "0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB"],
  ["d1220a0cf47c7b9be7a2e6ba89f429762e7b9adb", "0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb"],
])("toEip55: %s -> %s", (lower, expected) => {
  expect(toEip55(hexToBytes(lower))).toBe(expected);
});

test("toEip55: rejects non-20-byte input", () => {
  expect(() => toEip55(new Uint8Array(19))).toThrow();
});

test("isH160Hex: accepts 0x + 40 hex, rejects everything else", () => {
  expect(isH160Hex("0x9621Dde636de098B43efb0fa9b61FacFE328F99d")).toBe(true);
  expect(isH160Hex("0x9621dde636de098b43efb0fa9b61facfe328f99d")).toBe(true);
  expect(isH160Hex("9621dde636de098b43efb0fa9b61facfe328f99d")).toBe(false); // no 0x
  expect(isH160Hex("0x9621Dde636de098B43efb0fa9b61FacFE328F99")).toBe(false); // 39 hex
  expect(isH160Hex("0x9621Dde636de098B43efb0fa9b61FacFE328F99dd")).toBe(false); // 41 hex
  expect(isH160Hex("0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d")).toBe(
    false,
  );
});

test("h160FromHex: round-trips through toEip55", () => {
  const bytes = h160FromHex(ALICE_H160_EIP55);
  expect(bytes.length).toBe(20);
  expect(toEip55(bytes)).toBe(ALICE_H160_EIP55);
});
