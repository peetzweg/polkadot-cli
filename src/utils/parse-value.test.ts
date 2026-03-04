import { describe, expect, test } from "bun:test";
import { parseValue } from "./parse-value.ts";

describe("parseValue", () => {
  describe("integer parsing", () => {
    test("parses positive integer", () => {
      expect(parseValue("42")).toBe(42);
    });

    test("parses zero", () => {
      expect(parseValue("0")).toBe(0);
    });

    test("parses large integer", () => {
      expect(parseValue("123456789")).toBe(123456789);
    });
  });

  describe("bigint branch (unreachable — integer regex matches first)", () => {
    test("16+ digit number is parsed by parseInt, not BigInt", () => {
      const result = parseValue("1234567890123456");
      // /^\d+$/ matches first, so parseInt is called (lossy for large numbers)
      expect(typeof result).toBe("number");
      expect(result).toBe(parseInt("1234567890123456", 10));
    });
  });

  describe("hex passthrough", () => {
    test("returns hex string as-is", () => {
      expect(parseValue("0xdeadbeef")).toBe("0xdeadbeef");
    });

    test("returns 0x0 as-is", () => {
      expect(parseValue("0x0")).toBe("0x0");
    });

    test("returns uppercase hex as-is", () => {
      expect(parseValue("0xABCDEF")).toBe("0xABCDEF");
    });
  });

  describe("boolean parsing", () => {
    test("parses 'true'", () => {
      expect(parseValue("true")).toBe(true);
    });

    test("parses 'false'", () => {
      expect(parseValue("false")).toBe(false);
    });

    test("case-sensitive — 'True' falls through to string", () => {
      expect(parseValue("True")).toBe("True");
    });
  });

  describe("JSON parsing", () => {
    test("parses JSON object", () => {
      expect(parseValue('{"a":1}')).toEqual({ a: 1 });
    });

    test("parses JSON array", () => {
      expect(parseValue("[1,2,3]")).toEqual([1, 2, 3]);
    });

    test("invalid JSON falls through to string", () => {
      expect(parseValue("{malformed}")).toBe("{malformed}");
    });
  });

  describe("string fallthrough", () => {
    test("SS58 address returned as-is", () => {
      const addr = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY";
      expect(parseValue(addr)).toBe(addr);
    });

    test("empty string returned as-is", () => {
      expect(parseValue("")).toBe("");
    });

    test("plain string returned as-is", () => {
      expect(parseValue("hello")).toBe("hello");
    });
  });
});
