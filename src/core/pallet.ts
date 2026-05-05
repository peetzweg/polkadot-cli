import { CliError } from "../utils/errors.ts";

const MODL_PREFIX = new Uint8Array([0x6d, 0x6f, 0x64, 0x6c]); // "modl"
const PALLET_ID_BYTES = 8;

/**
 * Derive the 32-byte sovereign account ID for a pallet.
 *
 * Algorithm (matches Substrate's `AccountIdConversion::into_account_truncating`
 * for `PalletId`, whose `TYPE_ID` is `b"modl"`):
 *   prefix (4 bytes "modl") + palletId (8 bytes) + zero padding (20 bytes) = 32 bytes
 */
export function derivePalletAccount(palletId: Uint8Array): Uint8Array {
  if (palletId.length !== PALLET_ID_BYTES) {
    throw new CliError(
      `PalletId must be exactly ${PALLET_ID_BYTES} bytes (got ${palletId.length}).`,
    );
  }
  const result = new Uint8Array(32);
  result.set(MODL_PREFIX, 0);
  result.set(palletId, 4);
  return result;
}

/**
 * Parse a user-provided PalletId.
 *
 * Accepts:
 *   - 8-character ASCII string, e.g. "py/trsry"
 *   - 0x-prefixed hex with exactly 16 hex chars, e.g. "0x70792f7472737279"
 */
export function parsePalletId(input: string): Uint8Array {
  if (input.startsWith("0x") || input.startsWith("0X")) {
    const hex = input.slice(2);
    if (hex.length !== PALLET_ID_BYTES * 2) {
      throw new CliError(
        `Invalid PalletId hex "${input}". Must be 0x followed by exactly ${PALLET_ID_BYTES * 2} hex characters.`,
      );
    }
    if (!/^[0-9a-fA-F]+$/.test(hex)) {
      throw new CliError(`Invalid PalletId hex "${input}". Contains non-hex characters.`);
    }
    const bytes = new Uint8Array(PALLET_ID_BYTES);
    for (let i = 0; i < PALLET_ID_BYTES; i++) {
      bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }

  if (input.length !== PALLET_ID_BYTES) {
    throw new CliError(
      `Invalid PalletId "${input}". Must be ${PALLET_ID_BYTES} ASCII characters or 0x-prefixed hex.`,
    );
  }
  const bytes = new Uint8Array(PALLET_ID_BYTES);
  for (let i = 0; i < PALLET_ID_BYTES; i++) {
    const code = input.charCodeAt(i);
    if (code > 0x7f) {
      throw new CliError(`Invalid PalletId "${input}". ASCII form must contain only ASCII bytes.`);
    }
    bytes[i] = code;
  }
  return bytes;
}

/**
 * Format a PalletId as its ASCII representation if all bytes are printable
 * ASCII; otherwise as 0x-prefixed hex. Used for display in command output.
 */
export function formatPalletId(palletId: Uint8Array): string {
  const allPrintable = palletId.every((b) => b >= 0x20 && b <= 0x7e);
  if (allPrintable) {
    return Array.from(palletId, (b) => String.fromCharCode(b)).join("");
  }
  return `0x${Array.from(palletId, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}
