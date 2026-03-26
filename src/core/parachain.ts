export type SovereignAccountType = "child" | "sibling";

export const SOVEREIGN_ACCOUNT_TYPES: SovereignAccountType[] = ["child", "sibling"];

const PREFIXES: Record<SovereignAccountType, Uint8Array> = {
  child: new Uint8Array([0x70, 0x61, 0x72, 0x61]), // "para"
  sibling: new Uint8Array([0x73, 0x69, 0x62, 0x6c]), // "sibl"
};

/**
 * Derive the 32-byte sovereign account ID for a parachain.
 *
 * Algorithm (matches Substrate's `AccountIdConversion` for `ParaId`):
 *   prefix (4 bytes) + paraId as LE u32 (4 bytes) + zero padding (24 bytes) = 32 bytes
 */
export function deriveSovereignAccount(paraId: number, type: SovereignAccountType): Uint8Array {
  const result = new Uint8Array(32);
  result.set(PREFIXES[type], 0);
  new DataView(result.buffer).setUint32(4, paraId, true); // little-endian
  return result;
}

export function isValidParaId(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
}
