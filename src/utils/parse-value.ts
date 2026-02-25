export function parseValue(arg: string): unknown {
  // Try number
  if (/^\d+$/.test(arg)) return parseInt(arg, 10);
  // Try bigint for very large numbers
  if (/^\d{16,}$/.test(arg)) return BigInt(arg);
  // Hex
  if (/^0x[0-9a-fA-F]+$/.test(arg)) return arg;
  // Boolean
  if (arg === "true") return true;
  if (arg === "false") return false;
  // JSON
  if (arg.startsWith("{") || arg.startsWith("[")) {
    try {
      return JSON.parse(arg);
    } catch {
      // fall through
    }
  }
  // String (addresses, etc.)
  return arg;
}
