import { describe, expect, test } from "bun:test";
import { Binary } from "polkadot-api";
import { binaryToDisplay, isReadableText } from "./binary-display.ts";

describe("isReadableText", () => {
  test("empty string is readable", () => {
    expect(isReadableText("")).toBe(true);
  });

  test("ASCII text is readable", () => {
    expect(isReadableText("DOT")).toBe(true);
    expect(isReadableText("Polkadot")).toBe(true);
    expect(isReadableText("Paseo Token")).toBe(true);
  });

  test("text with allowed whitespace is readable", () => {
    expect(isReadableText("hello\tworld")).toBe(true);
    expect(isReadableText("line1\nline2")).toBe(true);
    expect(isReadableText("line1\r\nline2")).toBe(true);
  });

  test("international text is readable", () => {
    expect(isReadableText("日本語")).toBe(true);
    expect(isReadableText("Ürümqi")).toBe(true);
    expect(isReadableText("café")).toBe(true);
  });

  test("replacement character means not readable", () => {
    expect(isReadableText("abc\uFFFDdef")).toBe(false);
  });

  test("null byte means not readable", () => {
    expect(isReadableText("abc\x00def")).toBe(false);
  });

  test("C0 control characters mean not readable", () => {
    expect(isReadableText("abc\x01def")).toBe(false);
    expect(isReadableText("abc\x1Bdef")).toBe(false);
    expect(isReadableText("abc\x1Fdef")).toBe(false);
  });

  test("DEL character means not readable", () => {
    expect(isReadableText("abc\x7Fdef")).toBe(false);
  });

  test("C1 control characters mean not readable", () => {
    expect(isReadableText("abc\u0080def")).toBe(false);
    expect(isReadableText("abc\u009Fdef")).toBe(false);
  });

  test("Private Use Area characters mean not readable", () => {
    expect(isReadableText("abc\uE000def")).toBe(false);
    expect(isReadableText("abc\uF8FFdef")).toBe(false);
  });

  test("text prefix followed by binary-like chars is not readable", () => {
    expect(isReadableText("Collection\x00\x01\x02\x03")).toBe(false);
  });
});

describe("binaryToDisplay", () => {
  test("ASCII text returns text", () => {
    expect(binaryToDisplay(Binary.fromText("DOT"))).toBe("DOT");
  });

  test("multi-word text returns text", () => {
    expect(binaryToDisplay(Binary.fromText("Paseo Token"))).toBe("Paseo Token");
  });

  test("empty Binary returns empty string", () => {
    expect(binaryToDisplay(Binary.fromBytes(new Uint8Array([])))).toBe("");
  });

  test("invalid UTF-8 bytes return hex", () => {
    expect(binaryToDisplay(Binary.fromBytes(new Uint8Array([0x80, 0x81])))).toBe("0x8081");
  });

  test("bytes with null character return hex", () => {
    const bytes = new Uint8Array([0x41, 0x00, 0x42]); // "A\0B"
    expect(binaryToDisplay(Binary.fromBytes(bytes))).toBe("0x410042");
  });

  test("mixed text prefix + binary hash returns hex", () => {
    const prefix = new TextEncoder().encode("Col");
    const hash = new Uint8Array([0x00, 0x01, 0x9f, 0xe0, 0x00]);
    const combined = new Uint8Array([...prefix, ...hash]);
    expect(binaryToDisplay(Binary.fromBytes(combined))).toStartWith("0x");
  });
});
