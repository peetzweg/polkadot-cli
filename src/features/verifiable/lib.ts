import { blake2b } from "@noble/hashes/blake2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { compact } from "@polkadot-api/substrate-bindings";
import { mnemonicToEntropy } from "@polkadot-labs/hdkd-helpers";
import {
  alias_in_context,
  member_from_entropy,
  members_root,
  one_shot,
  sign,
  validate,
  validate_with_commitment,
  verify_signature,
} from "verifiablejs/nodejs";

/**
 * Bandersnatch / ring-VRF primitives over `verifiablejs`.
 *
 * Three derivation layers — do NOT conflate the two byte-strings involved:
 *
 *   mnemonic ─BIP39─▶ seed ─keyed blake2b─▶ Entropy ─▶ member key / secret
 *                            (key = entropy-key:                 │
 *                             "candidate" = full person,         │
 *                             omitted = lite person)             ▼
 *                                              one_shot(…, context, message)
 *                                                            └─ context = 32-byte
 *                                                               ring/proof namespace
 *                                                               (e.g. "dotns")
 *
 * - The 32-byte ring **context** is named `context` across the whole stack
 *   (runtime `type Context = [u8;32]`, iOS `deriveAlias(context:)`, verifiablejs
 *   `one_shot(…, context, …)`). It is the app/namespace identifier the alias is
 *   bound to.
 * - The **entropy-key** is the blake2b key used to derive the member entropy. It
 *   is NOT the context and NOT an sr25519 derivation path (it is a single keyed
 *   hash, no junctions). iOS models the choice as lite (unkeyed) vs full
 *   (`blake2b32WithKey("candidate")`). verifiablejs has no notion of it — the
 *   keying is a client convention applied before `member_from_entropy`.
 */

/** On-chain `RingExponent` discriminants (verifiablejs `RingExponent`). Capacity = 2^x − 257. */
const RING_EXPONENTS = [9, 10, 14] as const;
export type RingExponent = (typeof RING_EXPONENTS)[number];
/** R2e9 — capacity 255, smallest/fastest; the People ring exponent on nextv2. */
export const DEFAULT_RING_EXPONENT: RingExponent = 9;

export function isRingExponent(n: number): n is RingExponent {
  return (RING_EXPONENTS as readonly number[]).includes(n);
}

/** Decode a text-or-`0x`-hex flag value to bytes. `label` names the flag in errors. */
function textOrHexBytes(value: string, label: string): Uint8Array {
  if (value.startsWith("0x")) {
    const hex = value.slice(2);
    if (hex.length % 2 !== 0) {
      throw new Error(`Invalid hex ${label}: odd number of characters`);
    }
    return hexToBytes(hex);
  }
  return new TextEncoder().encode(value);
}

/**
 * Resolve an `--entropy-key` flag value to raw bytes used as the keyed-blake2b
 * key. `0x`-prefixed input is decoded as hex; anything else is UTF-8 encoded
 * (matching iOS `Data("candidate".utf8)`). Empty / undefined → unkeyed (lite).
 */
export function resolveEntropyKey(value: string | undefined): Uint8Array | undefined {
  if (value === undefined || value === "") return undefined;
  return textOrHexBytes(value, "entropy-key");
}

/**
 * Derive the 32-byte Bandersnatch member entropy from a BIP39 mnemonic.
 *
 * `blake2b256(bip39Entropy, key = entropyKey?)`. With no key this is a **lite**
 * person; keyed with `"candidate"` it is a **full** person. The key must match
 * whatever was used when the member was recognised on-chain, otherwise a
 * different (unrecognised) member key is produced.
 */
export function deriveMemberEntropy(mnemonic: string, entropyKey?: Uint8Array): Uint8Array {
  const entropy = mnemonicToEntropy(mnemonic);
  const opts: { dkLen: number; key?: Uint8Array } = { dkLen: 32 };
  if (entropyKey !== undefined && entropyKey.length > 0) {
    opts.key = entropyKey;
  }
  return blake2b(entropy, opts);
}

/** 32-byte Bandersnatch member public key from member entropy. */
export function deriveMemberKey(entropy: Uint8Array): Uint8Array {
  return member_from_entropy(entropy);
}

/**
 * Derive a Bandersnatch member key straight from a BIP39 mnemonic — the
 * composition {@link resolveEntropyKey} → {@link deriveMemberEntropy} →
 * {@link deriveMemberKey} (matching iOS FullPerson / Android CANDIDATE).
 */
export function deriveBandersnatchMember(mnemonic: string, entropyKey?: string): Uint8Array {
  return deriveMemberKey(deriveMemberEntropy(mnemonic, resolveEntropyKey(entropyKey)));
}

/** 32-byte alias for a member entropy under a given 32-byte ring context. */
export function deriveAlias(entropy: Uint8Array, context: Uint8Array): Uint8Array {
  return alias_in_context(entropy, context);
}

/** Standalone Bandersnatch signature (64 bytes) over `message`. */
export function bandersnatchSign(entropy: Uint8Array, message: Uint8Array): Uint8Array {
  return sign(entropy, message);
}

/** Verify a standalone Bandersnatch signature against a member public key. */
export function verifyBandersnatchSig(
  signature: Uint8Array,
  message: Uint8Array,
  member: Uint8Array,
): boolean {
  return verify_signature(signature, message, member);
}

export interface RingProof {
  /** Raw canonical ring-VRF proof bytes (785 on verifiablejs 1.3.0). */
  proof: Uint8Array;
  /** 32-byte alias the proof reveals — deterministic in (entropy, context). */
  alias: Uint8Array;
}

/**
 * Generate a ring-VRF proof (`one_shot`). The proof binds `message`; the alias
 * depends only on (entropy, context). `members` must be the SCALE-encoded
 * `Vec<[u8;32]>` ring (see {@link encodeMembers}). Proof bytes are
 * non-deterministic (randomised nonce); the alias is stable.
 */
export function ringProve(
  ringExp: RingExponent,
  entropy: Uint8Array,
  members: Uint8Array,
  context: Uint8Array,
  message: Uint8Array,
): RingProof {
  const result = one_shot(ringExp, entropy, members, context, message);
  return { proof: result.proof, alias: result.alias };
}

/**
 * Locally verify a ring-VRF proof, returning the recovered 32-byte alias or
 * throwing on failure. Pass either the SCALE-encoded `members` (`validate`) or
 * the 768-byte ring `commitment` / root as stored on chain
 * (`validate_with_commitment` — the recommended pre-flight before submitting).
 */
export function verifyRingProof(
  ringExp: RingExponent,
  proof: Uint8Array,
  source: { members?: Uint8Array; commitment?: Uint8Array },
  context: Uint8Array,
  message: Uint8Array,
): Uint8Array {
  if (source.commitment !== undefined) {
    return validate_with_commitment(ringExp, proof, source.commitment, context, message);
  }
  if (source.members !== undefined) {
    return validate(ringExp, proof, source.members, context, message);
  }
  throw new Error("verifyRingProof requires either `members` or `commitment`");
}

/** Compute the 768-byte ring root (MembersCommitment) from encoded members. */
export function ringRoot(ringExp: RingExponent, members: Uint8Array): Uint8Array {
  return members_root(ringExp, members);
}

/**
 * SCALE compact-encode a non-negative integer. Used only as the length prefix
 * for the members vector. Delegates to the canonical scale-ts codec.
 */
export function compactEncode(n: number): Uint8Array {
  if (!Number.isInteger(n) || n < 0)
    throw new Error("compactEncode: non-negative integer required");
  return compact.enc(n);
}

/**
 * SCALE-encode `Vec<[u8; 32]>` — the ring members list that `one_shot`,
 * `validate`, and `members_root` decode. Layout: compact length prefix followed
 * by the raw 32-byte member keys concatenated in order (fixed-size arrays carry
 * no per-element prefix). Each member must be exactly 32 bytes.
 */
export function encodeMembers(members: Uint8Array[]): Uint8Array {
  for (const m of members) {
    if (m.length !== 32) {
      throw new Error(`member key must be 32 bytes (got ${m.length})`);
    }
  }
  const prefix = compactEncode(members.length);
  const out = new Uint8Array(prefix.length + members.length * 32);
  out.set(prefix, 0);
  let offset = prefix.length;
  for (const m of members) {
    out.set(m, offset);
    offset += 32;
  }
  return out;
}

/**
 * Encode a ring `--context` value to 32 bytes, zero-padded on the right to match
 * Solidity `bytes32("…")` (NOT space-padded). `0x`-prefixed input is hex,
 * otherwise UTF-8. Rejects inputs longer than 32 bytes.
 */
export function encodeContext(input: string): Uint8Array {
  const bytes = textOrHexBytes(input, "context");
  if (bytes.length > 32) {
    throw new Error(`Context must be at most 32 bytes (got ${bytes.length})`);
  }
  const out = new Uint8Array(32);
  out.set(bytes, 0);
  return out;
}

/** One `People.Members.RingKeys` storage entry: keyArgs (collection, ring, page) + member keys. */
export interface RingKeyPageEntry {
  collection: Uint8Array;
  ring: number;
  page: number;
  keys: Uint8Array[];
}

/**
 * Assemble and SCALE-encode the ordered ring members for a (collection, ring)
 * from paginated `RingKeys` entries. `RingKeys` is paginated — a single ring can
 * be split across multiple page-index entries — and the pages MUST be
 * concatenated in page order because the ring root is computed over the
 * concatenated list. Entries for other collections/rings are ignored.
 */
export function assembleRingMembers(
  entries: RingKeyPageEntry[],
  collection: Uint8Array,
  ring: number,
): { members: Uint8Array; count: number } {
  const collHex = bytesToHex(collection);
  const pages = entries
    .filter((e) => bytesToHex(e.collection) === collHex && e.ring === ring)
    .sort((a, b) => a.page - b.page);
  const keys = pages.flatMap((p) => p.keys);
  return { members: encodeMembers(keys), count: keys.length };
}

/** One revision of a ring root stored in `MembersSubscriber.RingRoots[collection, ring]`. */
export interface RingRootRecord {
  revision: number;
  root: Uint8Array;
}

/**
 * Pick the newest revision from a chain's `RingRoots` list for a (collection,
 * ring). The chain retains a small window (3 revisions on nextv2-ah); a proof
 * must be built against a revision the chain still has, so callers submit
 * against the latest.
 */
export function pickLatestRingRoot(records: RingRootRecord[]): RingRootRecord {
  if (records.length === 0) {
    throw new Error("no ring roots found for this (collection, ring)");
  }
  return records.reduce((latest, r) => (r.revision > latest.revision ? r : latest));
}

const ALIAS_ACCOUNTS_TAG = new TextEncoder().encode("alias-accounts");

/**
 * Build the 32-byte msg the runtime binds for `AliasAccounts.set_alias_account`
 * and `reprove_alias_account` (the challenge fed to {@link ringProve} as
 * `message`). Mirrors the runtime `proof_message`
 * (`pallets/alias-accounts/src/lib.rs:633`):
 *
 *   blake2_256( SCALE("alias-accounts", account, proof_valid_at) )
 *   = blake2_256( "alias-accounts"(14b) || account(32b) || u64_LE(valid_at)(8b) )
 *
 * `proofValidAt` is bounded by the pallet's `ProofValidityWindow` (300s on AH),
 * so the proof must be submitted within that window of the supplied time.
 */
export function aliasProofMessage(accountPubkey: Uint8Array, proofValidAt: bigint): Uint8Array {
  if (accountPubkey.length !== 32) {
    throw new Error(`account public key must be 32 bytes (got ${accountPubkey.length})`);
  }
  if (proofValidAt < 0n || proofValidAt > 0xffffffffffffffffn) {
    // setBigUint64 would silently wrap modulo 2^64, hashing a different time.
    throw new Error(`proof_valid_at must be a u64 (got ${proofValidAt})`);
  }
  const u64 = new Uint8Array(8);
  new DataView(u64.buffer).setBigUint64(0, proofValidAt, true);
  const input = new Uint8Array(ALIAS_ACCOUNTS_TAG.length + 32 + 8);
  input.set(ALIAS_ACCOUNTS_TAG, 0);
  input.set(accountPubkey, ALIAS_ACCOUNTS_TAG.length);
  input.set(u64, ALIAS_ACCOUNTS_TAG.length + 32);
  return blake2b(input, { dkLen: 32 });
}
