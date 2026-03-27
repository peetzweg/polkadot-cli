import type { Binary } from "polkadot-api";

/**
 * Returns true if the decoded text looks like genuine human-readable text
 * rather than binary data that happens to be valid UTF-8.
 *
 * Rejects text containing control characters, the Unicode replacement
 * character, or Private Use Area code points.
 */
export function isReadableText(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);

    // C0 control characters (U+0000-U+001F) except tab, newline, carriage return
    if (code <= 0x1f && code !== 0x09 && code !== 0x0a && code !== 0x0d) return false;

    // DEL (U+007F)
    if (code === 0x7f) return false;

    // C1 control characters (U+0080-U+009F)
    if (code >= 0x80 && code <= 0x9f) return false;

    // Unicode replacement character (invalid UTF-8 decoding)
    if (code === 0xfffd) return false;

    // Private Use Area (U+E000-U+F8FF)
    if (code >= 0xe000 && code <= 0xf8ff) return false;
  }
  return true;
}

/**
 * Render a Binary as human-readable text when it looks like text,
 * otherwise fall back to hex representation.
 */
export function binaryToDisplay(value: Binary): string {
  const text = value.asText();
  return isReadableText(text) ? text : value.asHex();
}
