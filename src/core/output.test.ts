import { describe, expect, test } from "bun:test";
import { formatJson, formatPretty } from "./output.ts";

describe("formatJson", () => {
  test("formats object with 2-space indentation", () => {
    expect(formatJson({ a: 1 })).toBe('{\n  "a": 1\n}');
  });

  test("converts bigint values to strings", () => {
    expect(formatJson({ balance: 1000000000000n })).toBe('{\n  "balance": "1000000000000"\n}');
  });

  test("converts Uint8Array to 0x-prefixed hex", () => {
    expect(formatJson({ hash: new Uint8Array([0xde, 0xad]) })).toBe('{\n  "hash": "0xdead"\n}');
  });

  test("converts empty Uint8Array to 0x", () => {
    expect(formatJson({ data: new Uint8Array([]) })).toBe('{\n  "data": "0x"\n}');
  });

  test("handles nested objects with mixed types", () => {
    const data = {
      name: "alice",
      age: 30,
      balance: 42n,
      key: new Uint8Array([0xab, 0xcd]),
      active: true,
      extra: null,
    };
    const parsed = JSON.parse(formatJson(data));
    expect(parsed).toEqual({
      name: "alice",
      age: 30,
      balance: "42",
      key: "0xabcd",
      active: true,
      extra: null,
    });
  });

  test("handles arrays with mixed values", () => {
    const data = [1, "hello", 99n, new Uint8Array([0xff]), true, null];
    const parsed = JSON.parse(formatJson(data));
    expect(parsed).toEqual([1, "hello", "99", "0xff", true, null]);
  });

  test("returns 'null' for null input", () => {
    expect(formatJson(null)).toBe("null");
  });
});

describe("formatPretty", () => {
  test("returns a string for a plain object", () => {
    const result = formatPretty({ a: 1 });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("returns 'undefined' for undefined input", () => {
    expect(formatPretty(undefined)).toBe("undefined");
  });

  test("preserves same data as formatJson", () => {
    const data = { name: "bob", count: 5 };
    // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping ANSI escape codes
    const stripped = formatPretty(data).replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toBe(formatJson(data));
  });
});
