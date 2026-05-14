import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

const ETH_DERIVED_SUFFIX_BYTE = 0xee;
const H160_LEN = 20;
const ACCOUNT_ID_LEN = 32;

function hasEthDerivedSuffix(accountId: Uint8Array): boolean {
  if (accountId.length !== ACCOUNT_ID_LEN) return false;
  for (let i = H160_LEN; i < ACCOUNT_ID_LEN; i++) {
    if (accountId[i] !== ETH_DERIVED_SUFFIX_BYTE) return false;
  }
  return true;
}

// Mirrors pallet-revive's `AccountId32Mapper::to_address` on current master:
// if the last 12 bytes are 0xEE the account originated from an Eth address
// (strip suffix), otherwise hash the full 32 bytes with keccak-256 and take the
// last 20. Older runtimes (pre-stable2503) used plain `accountId[..20]`
// truncation — not implemented here.
export function accountIdToH160(accountId: Uint8Array): Uint8Array {
  if (accountId.length !== ACCOUNT_ID_LEN) {
    throw new Error(`accountIdToH160 expects 32 bytes, got ${accountId.length}`);
  }
  if (hasEthDerivedSuffix(accountId)) {
    return accountId.slice(0, H160_LEN);
  }
  return keccak_256(accountId).slice(ACCOUNT_ID_LEN - H160_LEN);
}

export function h160ToFallbackAccountId(h160: Uint8Array): Uint8Array {
  if (h160.length !== H160_LEN) {
    throw new Error(`h160ToFallbackAccountId expects 20 bytes, got ${h160.length}`);
  }
  const out = new Uint8Array(ACCOUNT_ID_LEN);
  out.set(h160, 0);
  out.fill(ETH_DERIVED_SUFFIX_BYTE, H160_LEN);
  return out;
}

export function toEip55(h160: Uint8Array): string {
  if (h160.length !== H160_LEN) {
    throw new Error(`toEip55 expects 20 bytes, got ${h160.length}`);
  }
  const lowerHex = bytesToHex(h160);
  const hashBytes = keccak_256(new TextEncoder().encode(lowerHex));
  let out = "0x";
  for (let i = 0; i < lowerHex.length; i++) {
    const c = lowerHex[i]!;
    const nibble = i % 2 === 0 ? hashBytes[i >> 1]! >> 4 : hashBytes[i >> 1]! & 0x0f;
    out += nibble >= 8 ? c.toUpperCase() : c;
  }
  return out;
}

export function isH160Hex(input: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(input);
}

export function h160FromHex(input: string): Uint8Array {
  if (!isH160Hex(input)) {
    throw new Error(`Not a valid 0x-prefixed 20-byte hex string: ${input}`);
  }
  return hexToBytes(input.slice(2));
}
