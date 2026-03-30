import { blake2b } from "@noble/hashes/blake2.js";
import { mnemonicToEntropy } from "@polkadot-labs/hdkd-helpers";
import { member_from_entropy } from "verifiablejs/nodejs";

/**
 * Derives a Bandersnatch member key from a BIP39 mnemonic.
 *
 * Flow (matching iOS FullPerson / Android CANDIDATE):
 *
 *   Mnemonic (12/24 words)
 *       │  mnemonicToEntropy()  (raw BIP39 entropy, NOT miniSecret)
 *       ▼
 *   blake2b256(entropy, key?)   (keyed or unkeyed depending on purpose)
 *       │
 *       ▼
 *   member_from_entropy()       (verifiablejs WASM → Bandersnatch curve)
 *       │
 *       ▼
 *   32-byte Bandersnatch public key ("member key")
 */
export function deriveBandersnatchMember(mnemonic: string, key?: string): Uint8Array {
  const entropy = mnemonicToEntropy(mnemonic);
  const opts: { dkLen: number; key?: Uint8Array } = { dkLen: 32 };
  if (key) {
    opts.key = new TextEncoder().encode(key);
  }
  const hashed = blake2b(entropy, opts);
  return member_from_entropy(hashed);
}
