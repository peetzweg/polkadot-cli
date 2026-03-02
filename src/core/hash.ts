import { blake2b } from "@noble/hashes/blake2.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

interface Algorithm {
  compute: (data: Uint8Array) => Uint8Array;
  outputLen: number;
  description: string;
}

export const ALGORITHMS: Record<string, Algorithm> = {
  blake2b256: {
    compute: (data) => blake2b(data, { dkLen: 32 }),
    outputLen: 32,
    description: "BLAKE2b with 256-bit output",
  },
  blake2b128: {
    compute: (data) => blake2b(data, { dkLen: 16 }),
    outputLen: 16,
    description: "BLAKE2b with 128-bit output",
  },
  keccak256: {
    compute: (data) => keccak_256(data),
    outputLen: 32,
    description: "Keccak-256 (Ethereum-compatible)",
  },
  sha256: {
    compute: (data) => sha256(data),
    outputLen: 32,
    description: "SHA-256",
  },
};

export function computeHash(algorithm: string, data: Uint8Array): Uint8Array {
  const algo = ALGORITHMS[algorithm];
  if (!algo) {
    throw new Error(`Unknown algorithm: ${algorithm}`);
  }
  return algo.compute(data);
}

export function parseInputData(input: string): Uint8Array {
  if (input.startsWith("0x")) {
    const hex = input.slice(2);
    if (hex.length % 2 !== 0) {
      throw new Error(`Invalid hex input: odd number of characters`);
    }
    return hexToBytes(hex);
  }
  return new TextEncoder().encode(input);
}

export function toHex(bytes: Uint8Array): string {
  return "0x" + bytesToHex(bytes);
}

export function isValidAlgorithm(name: string): boolean {
  return name in ALGORITHMS;
}

export function getAlgorithmNames(): string[] {
  return Object.keys(ALGORITHMS);
}
