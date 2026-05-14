const MASK = (1n << 64n) - 1n;
const P1 = 11400714785074694791n;
const P2 = 14029467366897019727n;
const P3 = 1609587929392839161n;
const P4 = 9650029242287828579n;
const P5 = 2870177450012600261n;

function rotl(v: bigint, r: bigint): bigint {
  return ((v << r) | (v >> (64n - r))) & MASK;
}

function round(acc: bigint, val: bigint): bigint {
  acc = (acc + val * P2) & MASK;
  acc = rotl(acc, 31n);
  return (acc * P1) & MASK;
}

function mergeRound(h: bigint, val: bigint): bigint {
  const k = round(0n, val);
  return ((h ^ k) * P1 + P4) & MASK;
}

function readU64LE(data: Uint8Array, p: number): bigint {
  return (
    BigInt(data[p]!) |
    (BigInt(data[p + 1]!) << 8n) |
    (BigInt(data[p + 2]!) << 16n) |
    (BigInt(data[p + 3]!) << 24n) |
    (BigInt(data[p + 4]!) << 32n) |
    (BigInt(data[p + 5]!) << 40n) |
    (BigInt(data[p + 6]!) << 48n) |
    (BigInt(data[p + 7]!) << 56n)
  );
}

function readU32LE(data: Uint8Array, p: number): bigint {
  return (
    BigInt(data[p]!) |
    (BigInt(data[p + 1]!) << 8n) |
    (BigInt(data[p + 2]!) << 16n) |
    (BigInt(data[p + 3]!) << 24n)
  );
}

export function xxh64(input: Uint8Array, seed: bigint = 0n): bigint {
  const len = input.length;
  let p = 0;
  let h: bigint;

  if (len >= 32) {
    let v1 = (seed + P1 + P2) & MASK;
    let v2 = (seed + P2) & MASK;
    let v3 = seed & MASK;
    let v4 = (seed - P1) & MASK;

    while (p <= len - 32) {
      v1 = round(v1, readU64LE(input, p));
      p += 8;
      v2 = round(v2, readU64LE(input, p));
      p += 8;
      v3 = round(v3, readU64LE(input, p));
      p += 8;
      v4 = round(v4, readU64LE(input, p));
      p += 8;
    }

    h = (rotl(v1, 1n) + rotl(v2, 7n) + rotl(v3, 12n) + rotl(v4, 18n)) & MASK;
    h = mergeRound(h, v1);
    h = mergeRound(h, v2);
    h = mergeRound(h, v3);
    h = mergeRound(h, v4);
  } else {
    h = (seed + P5) & MASK;
  }

  h = (h + BigInt(len)) & MASK;

  while (p + 8 <= len) {
    const k = round(0n, readU64LE(input, p));
    h = (rotl(h ^ k, 27n) * P1 + P4) & MASK;
    p += 8;
  }

  if (p + 4 <= len) {
    const k = (readU32LE(input, p) * P1) & MASK;
    h = (rotl(h ^ k, 23n) * P2 + P3) & MASK;
    p += 4;
  }

  while (p < len) {
    const k = (BigInt(input[p]!) * P5) & MASK;
    h = (rotl(h ^ k, 11n) * P1) & MASK;
    p++;
  }

  h ^= h >> 33n;
  h = (h * P2) & MASK;
  h ^= h >> 29n;
  h = (h * P3) & MASK;
  h ^= h >> 32n;

  return h;
}

function u64ToLEBytes(v: bigint, out: Uint8Array, offset: number): void {
  for (let i = 0; i < 8; i++) {
    out[offset + i] = Number((v >> BigInt(i * 8)) & 0xffn);
  }
}

export function twox(input: Uint8Array, bits: 64 | 128 | 256): Uint8Array {
  const lanes = bits / 64;
  const out = new Uint8Array(bits / 8);
  for (let i = 0; i < lanes; i++) {
    u64ToLEBytes(xxh64(input, BigInt(i)), out, i * 8);
  }
  return out;
}
