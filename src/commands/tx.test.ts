import { describe, expect, test } from "bun:test";
import { Binary } from "polkadot-api";
import { getTestMetadata } from "./__fixtures__/load-metadata.ts";
import { runCli } from "./__fixtures__/run-cli.ts";
import {
  autoDefaultForType,
  buildCustomSignedExtensions,
  decodeCallFallback,
  decodeCallToFileFormat,
  fileArgsToStrings,
  formatDispatchError,
  formatEventValue,
  formatRawDecoded,
  NO_DEFAULT,
  normalizeValue,
  parseCallArgs,
  parseEnumShorthand,
  parseExtOption,
  parsePrimitive,
  parseTypedArg,
  parseWaitLevel,
  sanitizeForSerialization,
  typeHint,
} from "./tx.ts";

const meta = getTestMetadata();

// ---------------------------------------------------------------------------
// parseWaitLevel
// ---------------------------------------------------------------------------

describe("parseWaitLevel", () => {
  test('"broadcast" returns "broadcast"', () => {
    expect(parseWaitLevel("broadcast")).toBe("broadcast");
  });

  test('"best-block" returns "best-block"', () => {
    expect(parseWaitLevel("best-block")).toBe("best-block");
  });

  test('"best" returns "best-block"', () => {
    expect(parseWaitLevel("best")).toBe("best-block");
  });

  test('"finalized" returns "finalized"', () => {
    expect(parseWaitLevel("finalized")).toBe("finalized");
  });

  test("undefined returns finalized", () => {
    expect(parseWaitLevel(undefined)).toBe("finalized");
  });

  test("invalid value throws CliError", () => {
    expect(() => parseWaitLevel("invalid")).toThrow('Invalid --wait value "invalid"');
  });
});

// ---------------------------------------------------------------------------
// Layer 2: Function-level tests
// ---------------------------------------------------------------------------

describe("parsePrimitive", () => {
  test("bool true", () => {
    expect(parsePrimitive("bool", "true")).toBe(true);
  });

  test("bool false", () => {
    expect(parsePrimitive("bool", "false")).toBe(false);
  });

  test("u32", () => {
    expect(parsePrimitive("u32", "42")).toBe(42);
  });

  test("u128 as bigint", () => {
    expect(parsePrimitive("u128", "1000000000000")).toBe(1000000000000n);
  });

  test("u256 as bigint", () => {
    expect(parsePrimitive("u256", "99999999999999999999")).toBe(99999999999999999999n);
  });

  test("i64 as bigint", () => {
    expect(parsePrimitive("i64", "-42")).toBe(-42n);
  });

  test("str passthrough", () => {
    expect(parsePrimitive("str", "hello")).toBe("hello");
  });

  test("char passthrough", () => {
    expect(parsePrimitive("char", "x")).toBe("x");
  });
});

describe("parseEnumShorthand", () => {
  test("returns null for plain variant name (no parens)", () => {
    expect(parseEnumShorthand("Root")).toBeNull();
  });

  test("parses Parachain(1000)", () => {
    expect(parseEnumShorthand("Parachain(1000)")).toEqual({
      variant: "Parachain",
      inner: "1000",
    });
  });

  test("parses system(Authorized)", () => {
    expect(parseEnumShorthand("system(Authorized)")).toEqual({
      variant: "system",
      inner: "Authorized",
    });
  });

  test("parses nested system(Signed(5FHn...))", () => {
    expect(parseEnumShorthand("system(Signed(5FHn...))")).toEqual({
      variant: "system",
      inner: "Signed(5FHn...)",
    });
  });

  test("returns null for JSON", () => {
    expect(parseEnumShorthand('{"type":"Root"}')).toBeNull();
  });

  test("returns null for hex", () => {
    expect(parseEnumShorthand("0xdead")).toBeNull();
  });

  test("parses Root() as empty inner", () => {
    expect(parseEnumShorthand("Root()")).toEqual({
      variant: "Root",
      inner: "",
    });
  });

  test("returns null for array-like input", () => {
    expect(parseEnumShorthand("[1,2,3]")).toBeNull();
  });
});

describe("parseCallArgs", () => {
  test("System.remark with hex bytes", async () => {
    const result = (await parseCallArgs(meta, "System", "remark", ["0xdeadbeef"])) as Record<
      string,
      unknown
    >;
    // System.remark is a struct variant with field "remark"
    expect(result.remark).toBeInstanceOf(Binary);
    expect((result.remark as Binary).asHex()).toBe("0xdeadbeef");
  });

  test("System.remark with plain text", async () => {
    const result = (await parseCallArgs(meta, "System", "remark", ["hello"])) as Record<
      string,
      unknown
    >;
    expect(result.remark).toBeInstanceOf(Binary);
    expect((result.remark as Binary).asText()).toBe("hello");
  });

  test("Balances.transferKeepAlive with address and amount", async () => {
    const addr = "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty";
    const result = (await parseCallArgs(meta, "Balances", "transfer_keep_alive", [
      addr,
      "1000000000000",
    ])) as Record<string, unknown>;
    expect(result.dest).toEqual({ type: "Id", value: addr });
    expect(result.value).toBe(1000000000000n);
  });

  test("wrong arg count throws", async () => {
    expect(parseCallArgs(meta, "System", "remark", ["0xaa", "extra"])).rejects.toThrow(
      /takes 1 argument/,
    );
  });

  test("too few args throws with expected types", async () => {
    expect(
      parseCallArgs(meta, "Balances", "transfer_keep_alive", [
        "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
      ]),
    ).rejects.toThrow(/takes 2 argument/);
  });

  test("zero args for non-void call throws", async () => {
    expect(parseCallArgs(meta, "System", "remark", [])).rejects.toThrow(/takes 1 argument/);
  });

  test("struct arg parse error includes field name and expected type", async () => {
    // Balances.transfer_keep_alive has struct fields: dest (MultiAddress), value (Compact<u128>)
    // Passing "abc" for the amount should fail with contextual info
    expect(
      parseCallArgs(meta, "Balances", "transfer_keep_alive", [
        "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
        "abc",
      ]),
    ).rejects.toThrow(/Invalid value for argument 'value'/);
  });

  test("struct arg parse error includes expected type description", async () => {
    expect(
      parseCallArgs(meta, "Balances", "transfer_keep_alive", [
        "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
        "abc",
      ]),
    ).rejects.toThrow(/expected/);
  });

  test("struct arg parse error includes the invalid value in the message", async () => {
    expect(
      parseCallArgs(meta, "Balances", "transfer_keep_alive", [
        "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
        "abc",
      ]),
    ).rejects.toThrow(/"abc"/);
  });

  test("struct arg parse error includes a hint", async () => {
    expect(
      parseCallArgs(meta, "Balances", "transfer_keep_alive", [
        "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
        "abc",
      ]),
    ).rejects.toThrow(/Hint:/);
  });

  test("struct arg parse error preserves original cause", async () => {
    try {
      await parseCallArgs(meta, "Balances", "transfer_keep_alive", [
        "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
        "abc",
      ]);
      throw new Error("should have thrown");
    } catch (err: any) {
      expect(err.cause).toBeDefined();
    }
  });
});

describe("parseTypedArg", () => {
  test("decodes hex RuntimeCall for Sudo-style usage", async () => {
    // Encode System.remark(0xaa) → hex, then parse it back through parseTypedArg
    const { codec, location } = meta.builder.buildCall("System", "remark");
    const callData = { remark: Binary.fromHex("0xaa") };
    const encodedArgs = codec.enc(callData);
    const fullCall = new Uint8Array([location[0], location[1], ...encodedArgs]);
    const callHex = Binary.fromBytes(fullCall).asHex();

    const callTypeId = meta.lookup.call;
    if (callTypeId == null) throw new Error("No RuntimeCall in metadata");
    const callEntry = meta.lookup(callTypeId);

    const decoded = (await parseTypedArg(meta, callEntry, callHex)) as {
      type: string;
      value: { type: string; value: unknown };
    };
    expect(decoded.type).toBe("System");
    expect(decoded.value.type).toBe("remark");
  });

  test("auto-wraps SS58 address to MultiAddress.Id", async () => {
    // Find the dest field type from Balances.transfer_keep_alive
    const palletMeta = meta.unified.pallets.find((p) => p.name === "Balances")!;
    const callsEntry = meta.lookup(palletMeta.calls!.type);
    const variant = ((callsEntry as any).value as Record<string, any>).transfer_keep_alive;
    // The variant may be a lookupEntry wrapping a struct
    let inner = variant;
    while (inner.type === "lookupEntry") inner = inner.value;
    const destEntry = inner.value.dest;

    const addr = "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty";
    const result = (await parseTypedArg(meta, destEntry, addr)) as { type: string; value: string };
    expect(result).toEqual({ type: "Id", value: addr });
  });

  test("option with 'null' returns undefined", async () => {
    const optionEntry = {
      type: "option",
      value: { type: "primitive", value: "u32" },
    };
    expect(await parseTypedArg(meta, optionEntry, "null")).toBeUndefined();
    expect(await parseTypedArg(meta, optionEntry, "none")).toBeUndefined();
  });

  test("compact u128 returns bigint", async () => {
    const compactEntry = { type: "compact", isBig: true };
    expect(await parseTypedArg(meta, compactEntry, "1000000000000")).toBe(1000000000000n);
  });

  test("compact u32 returns number", async () => {
    const compactEntry = { type: "compact", isBig: false };
    expect(await parseTypedArg(meta, compactEntry, "42")).toBe(42);
  });

  test("enum shorthand Parachain(1000) with number inner", async () => {
    const enumEntry = {
      type: "enum",
      value: {
        Parachain: { type: "compact", isBig: false },
        Here: { type: "void" },
      },
    };
    expect(await parseTypedArg(meta, enumEntry, "Parachain(1000)")).toEqual({
      type: "Parachain",
      value: 1000,
    });
  });

  test("enum shorthand system(Authorized) with nested enum", async () => {
    const enumEntry = {
      type: "enum",
      value: {
        system: {
          type: "enum",
          value: {
            Root: { type: "void" },
            Authorized: { type: "void" },
          },
        },
      },
    };
    expect(await parseTypedArg(meta, enumEntry, "system(Authorized)")).toEqual({
      type: "system",
      value: { type: "Authorized" },
    });
  });

  test("enum shorthand is case-insensitive", async () => {
    const enumEntry = {
      type: "enum",
      value: {
        Parachain: { type: "compact", isBig: false },
      },
    };
    expect(await parseTypedArg(meta, enumEntry, "parachain(42)")).toEqual({
      type: "Parachain",
      value: 42,
    });
  });

  test("enum shorthand Root() treated as void", async () => {
    const enumEntry = {
      type: "enum",
      value: {
        Root: { type: "void" },
      },
    };
    expect(await parseTypedArg(meta, enumEntry, "Root()")).toEqual({ type: "Root" });
  });

  test("enum shorthand with JSON inner for structs", async () => {
    const enumEntry = {
      type: "enum",
      value: {
        AccountId32: {
          type: "struct",
          value: {
            id: { type: "array", value: { type: "primitive", value: "u8" }, len: 32 },
          },
        },
      },
    };
    const hex = "0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d";
    const result = (await parseTypedArg(meta, enumEntry, `AccountId32({"id":"${hex}"})`)) as any;
    expect(result.type).toBe("AccountId32");
    expect(result.value.id).toBeInstanceOf(Binary);
  });

  test("enum shorthand does not break SS58 auto-wrap", async () => {
    // SS58 addresses don't match shorthand pattern (no parens), so MultiAddress auto-wrap still works
    const palletMeta = meta.unified.pallets.find((p) => p.name === "Balances")!;
    const callsEntry = meta.lookup(palletMeta.calls!.type);
    const variant = ((callsEntry as any).value as Record<string, any>).transfer_keep_alive;
    let inner = variant;
    while (inner.type === "lookupEntry") inner = inner.value;
    const destEntry = inner.value.dest;

    const addr = "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty";
    expect(await parseTypedArg(meta, destEntry, addr)).toEqual({ type: "Id", value: addr });
  });

  test("enum shorthand does not break JSON format", async () => {
    const enumEntry = {
      type: "enum",
      value: {
        Parachain: { type: "compact", isBig: false },
      },
    };
    expect(await parseTypedArg(meta, enumEntry, '{"type":"Parachain","value":1000}')).toEqual({
      type: "Parachain",
      value: 1000,
    });
  });

  test("enum shorthand does not break void variant name", async () => {
    const enumEntry = {
      type: "enum",
      value: {
        Root: { type: "void" },
        Signed: { type: "AccountId32" },
      },
    };
    expect(await parseTypedArg(meta, enumEntry, "Root")).toEqual({ type: "Root" });
  });

  test("simple variant name resolves lookupEntry-wrapped void", async () => {
    // Simulates metadata where a void variant is wrapped in lookupEntry indirection
    // (e.g. RingSize enum variants like R2e9 in ChunksManager.Chunks)
    const enumEntry = {
      type: "enum",
      value: {
        R2e9: { type: "lookupEntry", value: { type: "void" } },
        R2e10: { type: "lookupEntry", value: { type: "void" } },
      },
    };
    expect(await parseTypedArg(meta, enumEntry, "R2e9")).toEqual({ type: "R2e9" });
  });

  test("simple variant name resolves lookupEntry-wrapped void case-insensitively", async () => {
    const enumEntry = {
      type: "enum",
      value: {
        R2e9: { type: "lookupEntry", value: { type: "void" } },
      },
    };
    expect(await parseTypedArg(meta, enumEntry, "r2e9")).toEqual({ type: "R2e9" });
  });

  test("enum shorthand resolves lookupEntry-wrapped void with parens", async () => {
    const enumEntry = {
      type: "enum",
      value: {
        R2e9: { type: "lookupEntry", value: { type: "void" } },
      },
    };
    expect(await parseTypedArg(meta, enumEntry, "R2e9()")).toEqual({ type: "R2e9" });
  });

  test("lookupEntry-wrapped non-void variant does not short-circuit", async () => {
    // A variant whose resolved type is NOT void should NOT return { type }
    const enumEntry = {
      type: "enum",
      value: {
        Parachain: { type: "lookupEntry", value: { type: "compact", isBig: false } },
      },
    };
    // Plain "Parachain" without value should fall through (not match void path)
    expect(await parseTypedArg(meta, enumEntry, "Parachain")).toBe("Parachain");
  });
});

describe("typeHint", () => {
  test("enum with few variants lists them", () => {
    const entry = {
      type: "enum",
      value: { A: { type: "void" }, B: { type: "void" }, C: { type: "void" } },
    };
    const hint = typeHint(entry, meta);
    expect(hint).toContain("a variant:");
    expect(hint).toContain("A | B | C");
  });

  test("enum with many variants shows count and examples", () => {
    const variants: Record<string, any> = {};
    for (let i = 0; i < 10; i++) {
      variants[`Var${i}`] = { type: "void" };
    }
    const entry = { type: "enum", value: variants };
    const hint = typeHint(entry, meta);
    expect(hint).toContain("one of 10 variants");
    expect(hint).toContain("e.g.");
  });

  test("struct lists field names", () => {
    const entry = {
      type: "struct",
      value: { foo: { type: "primitive", value: "u32" }, bar: { type: "primitive", value: "str" } },
    };
    const hint = typeHint(entry, meta);
    expect(hint).toContain("a JSON object with fields:");
    expect(hint).toContain("foo");
    expect(hint).toContain("bar");
  });

  test("tuple returns array hint", () => {
    const entry = { type: "tuple", value: [] };
    expect(typeHint(entry, meta)).toBe("a JSON array");
  });

  test("sequence returns array/hex hint", () => {
    const entry = { type: "sequence", value: { type: "primitive", value: "u32" } };
    expect(typeHint(entry, meta)).toBe("a JSON array or hex-encoded bytes");
  });

  test("array returns array/hex hint", () => {
    const entry = { type: "array", value: { type: "primitive", value: "u8" }, len: 32 };
    expect(typeHint(entry, meta)).toBe("a JSON array or hex-encoded bytes");
  });

  test("resolves lookupEntry indirection", () => {
    const entry = {
      type: "lookupEntry",
      value: {
        type: "struct",
        value: { x: { type: "primitive", value: "u32" } },
      },
    };
    const hint = typeHint(entry, meta);
    expect(hint).toContain("a JSON object with fields:");
    expect(hint).toContain("x");
  });
});

describe("normalizeValue", () => {
  test("unwraps single-element array for non-array enum variant", () => {
    // Simulates XCM Junctions::X1 where polkadot-api unwrapped [Junction; 1]
    const mockEntry = {
      type: "enum",
      value: {
        SomeVariant: { type: "struct", value: { a: { type: "primitive", value: "u32" } } },
      },
    };
    const input = { type: "SomeVariant", value: [{ a: 42 }] };
    const result = normalizeValue(meta.lookup, mockEntry, input) as {
      type: string;
      value: unknown;
    };
    expect(result.type).toBe("SomeVariant");
    expect(result.value).toEqual({ a: 42 });
  });

  test("does NOT unwrap multi-element arrays", () => {
    const mockEntry = {
      type: "enum",
      value: {
        X2: { type: "struct", value: { a: { type: "primitive", value: "u32" } } },
      },
    };
    const input = { type: "X2", value: [{ a: 1 }, { a: 2 }] };
    const result = normalizeValue(meta.lookup, mockEntry, input) as {
      type: string;
      value: unknown;
    };
    // Multi-element array should be left as-is
    expect(Array.isArray(result.value)).toBe(true);
    expect((result.value as any[]).length).toBe(2);
  });

  test("does NOT unwrap array when inner type IS array", () => {
    const mockEntry = {
      type: "enum",
      value: {
        Multi: { type: "array", value: { type: "primitive", value: "u8" }, len: 3 },
      },
    };
    const input = { type: "Multi", value: [1] };
    const result = normalizeValue(meta.lookup, mockEntry, input) as {
      type: string;
      value: unknown;
    };
    expect(Array.isArray(result.value)).toBe(true);
  });

  test("does NOT unwrap when inner type IS sequence", () => {
    const mockEntry = {
      type: "enum",
      value: {
        Items: { type: "sequence", value: { type: "primitive", value: "u32" } },
      },
    };
    const input = { type: "Items", value: [42] };
    const result = normalizeValue(meta.lookup, mockEntry, input) as {
      type: string;
      value: unknown;
    };
    expect(Array.isArray(result.value)).toBe(true);
  });

  test("recursively unwraps nested enum variants", () => {
    // Outer enum → inner enum, both with single-element array wrapping
    const mockEntry = {
      type: "enum",
      value: {
        Outer: {
          type: "enum",
          value: {
            Inner: { type: "primitive", value: "u32" },
          },
        },
      },
    };
    const input = { type: "Outer", value: [{ type: "Inner", value: [99] }] };
    const result = normalizeValue(meta.lookup, mockEntry, input) as any;
    expect(result.type).toBe("Outer");
    // Outer single-element array unwrapped
    expect(result.value.type).toBe("Inner");
    // Inner single-element array unwrapped
    expect(result.value.value).toBe(99);
  });

  test("recursively normalizes struct fields", () => {
    const mockEntry = {
      type: "struct",
      value: {
        name: { type: "primitive", value: "str" },
        count: { type: "primitive", value: "u32" },
      },
    };
    const input = { name: "test", count: 5 };
    const result = normalizeValue(meta.lookup, mockEntry, input);
    expect(result).toEqual({ name: "test", count: 5 });
  });

  test("normalizes array elements recursively", () => {
    const mockEntry = {
      type: "sequence",
      value: {
        type: "enum",
        value: {
          Variant: { type: "primitive", value: "u32" },
        },
      },
    };
    const input = [
      { type: "Variant", value: [1] },
      { type: "Variant", value: [2] },
    ];
    const result = normalizeValue(meta.lookup, mockEntry, input) as any[];
    expect(result[0]).toEqual({ type: "Variant", value: 1 });
    expect(result[1]).toEqual({ type: "Variant", value: 2 });
  });

  test("normalizes option inner value", () => {
    const mockEntry = {
      type: "option",
      value: {
        type: "enum",
        value: {
          Thing: { type: "primitive", value: "u32" },
        },
      },
    };
    const input = { type: "Thing", value: [42] };
    const result = normalizeValue(meta.lookup, mockEntry, input) as any;
    expect(result).toEqual({ type: "Thing", value: 42 });
  });

  test("option with null/undefined normalizes to undefined", () => {
    const mockEntry = {
      type: "option",
      value: { type: "primitive", value: "u32" },
    };
    // polkadot-api uses undefined for Option::None; JSON null must also map to undefined
    expect(normalizeValue(meta.lookup, mockEntry, null)).toBeUndefined();
    expect(normalizeValue(meta.lookup, mockEntry, undefined)).toBeUndefined();
  });

  test("leaves void enum variant value alone", () => {
    const mockEntry = {
      type: "enum",
      value: {
        None: { type: "void" },
      },
    };
    const input = { type: "None", value: undefined };
    const result = normalizeValue(meta.lookup, mockEntry, input) as any;
    expect(result.type).toBe("None");
    expect(result.value).toBeUndefined();
  });

  test("resolves lookupEntry indirection", () => {
    const mockEntry = {
      type: "lookupEntry",
      value: {
        type: "enum",
        value: {
          X1: { type: "primitive", value: "u32" },
        },
      },
    };
    const input = { type: "X1", value: [7] };
    const result = normalizeValue(meta.lookup, mockEntry, input) as any;
    expect(result).toEqual({ type: "X1", value: 7 });
  });

  test("converts hex string to Binary for [u8; N] byte arrays", () => {
    const mockEntry = {
      type: "array",
      value: { type: "primitive", value: "u8" },
      len: 32,
    };
    const hex = "0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d";
    const result = normalizeValue(meta.lookup, mockEntry, hex);
    expect(result).toBeInstanceOf(Binary);
    expect((result as Binary).asHex()).toBe(hex);
  });

  test("converts text string to Binary for Vec<u8> byte sequences", () => {
    const mockEntry = {
      type: "sequence",
      value: { type: "primitive", value: "u8" },
    };
    const result = normalizeValue(meta.lookup, mockEntry, "hello");
    expect(result).toBeInstanceOf(Binary);
    expect((result as Binary).asText()).toBe("hello");
  });

  test("converts hex string to Binary for [u8; N] through lookupEntry indirection", () => {
    const mockEntry = {
      type: "array",
      value: { type: "lookupEntry", value: { type: "primitive", value: "u8" } },
      len: 4,
    };
    const result = normalizeValue(meta.lookup, mockEntry, "0xdeadbeef");
    expect(result).toBeInstanceOf(Binary);
    expect((result as Binary).asHex()).toBe("0xdeadbeef");
  });

  test("converts nested byte arrays inside structs", () => {
    const mockEntry = {
      type: "struct",
      value: {
        id: { type: "array", value: { type: "primitive", value: "u8" }, len: 32 },
      },
    };
    const hex = "0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d";
    const result = normalizeValue(meta.lookup, mockEntry, { id: hex }) as any;
    expect(result.id).toBeInstanceOf(Binary);
    expect((result.id as Binary).asHex()).toBe(hex);
  });

  test("converts nested byte arrays inside enum variants", () => {
    const mockEntry = {
      type: "enum",
      value: {
        AccountId32: {
          type: "struct",
          value: {
            id: { type: "array", value: { type: "primitive", value: "u8" }, len: 32 },
          },
        },
      },
    };
    const hex = "0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d";
    const input = { type: "AccountId32", value: { id: hex } };
    const result = normalizeValue(meta.lookup, mockEntry, input) as any;
    expect(result.value.id).toBeInstanceOf(Binary);
    expect((result.value.id as Binary).asHex()).toBe(hex);
  });

  test("converts string to bigint for u128 primitives in JSON", () => {
    const mockEntry = { type: "primitive", value: "u128" };
    const result = normalizeValue(meta.lookup, mockEntry, "100000000000000000");
    expect(result).toBe(100000000000000000n);
  });

  test("converts string to number for u32 primitives in JSON", () => {
    const mockEntry = { type: "primitive", value: "u32" };
    const result = normalizeValue(meta.lookup, mockEntry, "42");
    expect(result).toBe(42);
  });

  test("converts string to bigint for compact types in JSON", () => {
    const mockEntry = { type: "compact", isBig: true };
    const result = normalizeValue(meta.lookup, mockEntry, "100000000000000000");
    expect(result).toBe(100000000000000000n);
  });

  test("converts string to number for small compact types in JSON", () => {
    const mockEntry = { type: "compact", isBig: false };
    const result = normalizeValue(meta.lookup, mockEntry, "42");
    expect(result).toBe(42);
  });

  test("leaves bigint alone for u128 primitives", () => {
    const mockEntry = { type: "primitive", value: "u128" };
    expect(normalizeValue(meta.lookup, mockEntry, 42n)).toBe(42n);
  });

  test("converts number to bigint for u128 primitives (file/YAML input)", () => {
    const mockEntry = { type: "primitive", value: "u128" };
    expect(normalizeValue(meta.lookup, mockEntry, 42)).toBe(42n);
  });

  test("leaves number alone for u32 primitives", () => {
    const mockEntry = { type: "primitive", value: "u32" };
    expect(normalizeValue(meta.lookup, mockEntry, 42)).toBe(42);
  });

  test("converts number to bigint for u64 primitives", () => {
    const mockEntry = { type: "primitive", value: "u64" };
    expect(normalizeValue(meta.lookup, mockEntry, 100)).toBe(100n);
  });

  test("converts number to bigint for u256 primitives", () => {
    const mockEntry = { type: "primitive", value: "u256" };
    expect(normalizeValue(meta.lookup, mockEntry, 0)).toBe(0n);
  });

  test("converts number to bigint for i128 primitives", () => {
    const mockEntry = { type: "primitive", value: "i128" };
    expect(normalizeValue(meta.lookup, mockEntry, -5)).toBe(-5n);
  });

  test("converts number to bigint for big compact types", () => {
    const mockEntry = { type: "compact", isBig: true };
    expect(normalizeValue(meta.lookup, mockEntry, 42)).toBe(42n);
  });

  test("leaves number alone for small compact types", () => {
    const mockEntry = { type: "compact", isBig: false };
    expect(normalizeValue(meta.lookup, mockEntry, 42)).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// fileArgsToStrings
// ---------------------------------------------------------------------------

describe("fileArgsToStrings", () => {
  test("returns empty array for null", () => {
    expect(fileArgsToStrings(null)).toEqual([]);
  });

  test("returns empty array for undefined", () => {
    expect(fileArgsToStrings(undefined)).toEqual([]);
  });

  test("converts object to individual string values", () => {
    const result = fileArgsToStrings({ dest: "alice", value: 1000 });
    expect(result).toEqual(["alice", "1000"]);
  });

  test("serializes nested objects as JSON", () => {
    const result = fileArgsToStrings({
      dest: { type: "V3", value: { parents: 1 } },
      amount: 42,
    });
    expect(result).toEqual(['{"type":"V3","value":{"parents":1}}', "42"]);
  });

  test("converts array elements to strings", () => {
    expect(fileArgsToStrings(["0xdead", "0xbeef"])).toEqual(["0xdead", "0xbeef"]);
  });

  test("serializes complex array elements as JSON", () => {
    const result = fileArgsToStrings([{ type: "V3" }, 0]);
    expect(result).toEqual(['{"type":"V3"}', "0"]);
  });

  test("converts scalar string", () => {
    expect(fileArgsToStrings("0xdead")).toEqual(["0xdead"]);
  });

  test("converts scalar number", () => {
    expect(fileArgsToStrings(42)).toEqual(["42"]);
  });

  test("converts scalar boolean", () => {
    expect(fileArgsToStrings(true)).toEqual(["true"]);
  });

  test("converts null values in objects", () => {
    const result = fileArgsToStrings({ key: null });
    expect(result).toEqual(["null"]);
  });
});

describe("formatEventValue", () => {
  test("Binary with valid UTF-8 returns text", () => {
    expect(formatEventValue(Binary.fromText("DOT"))).toBe("DOT");
  });

  test("Binary with invalid UTF-8 returns hex", () => {
    expect(formatEventValue(Binary.fromBytes(new Uint8Array([0x80, 0x81])))).toBe("0x8081");
  });

  test("empty Binary returns empty string", () => {
    expect(formatEventValue(Binary.fromBytes(new Uint8Array([])))).toBe("");
  });

  test("bigint returns string", () => {
    expect(formatEventValue(42n)).toBe("42");
  });

  test("string passes through", () => {
    expect(formatEventValue("hello")).toBe("hello");
  });

  test("null returns 'null'", () => {
    expect(formatEventValue(null)).toBe("null");
  });

  test("object is JSON-stringified", () => {
    expect(formatEventValue({ a: 1 })).toBe('{"a":1}');
  });
});

describe("formatDispatchError", () => {
  test("Module error formats as PalletName.ErrorVariant", () => {
    const err = {
      type: "Module",
      value: { type: "Balances", value: { type: "InsufficientBalance" } },
    };
    expect(formatDispatchError(err)).toBe("Balances.InsufficientBalance");
  });

  test("Module error with pallet only (no inner variant)", () => {
    const err = {
      type: "Module",
      value: { type: "Balances" },
    };
    expect(formatDispatchError(err)).toBe("Balances");
  });

  test("non-Module error with no value", () => {
    const err = { type: "BadOrigin" };
    expect(formatDispatchError(err)).toBe("BadOrigin");
  });

  test("non-Module error with string value", () => {
    const err = { type: "Token", value: "FundsUnavailable" };
    expect(formatDispatchError(err)).toBe("Token: FundsUnavailable");
  });

  test("non-Module error with object value", () => {
    const err = { type: "Token", value: { reason: "frozen" } };
    expect(formatDispatchError(err)).toBe('Token: {"reason":"frozen"}');
  });

  test("Module error with non-object value falls back to type: value", () => {
    const err = { type: "Module", value: "unexpected" };
    expect(formatDispatchError(err)).toBe("Module: unexpected");
  });
});

// ---------------------------------------------------------------------------
// parseExtOption
// ---------------------------------------------------------------------------

describe("parseExtOption", () => {
  test("undefined returns empty object", () => {
    expect(parseExtOption(undefined)).toEqual({});
  });

  test("valid JSON object is returned", () => {
    expect(parseExtOption('{"Foo":{"value":1}}')).toEqual({ Foo: { value: 1 } });
  });

  test("JSON array throws", () => {
    expect(() => parseExtOption("[1,2]")).toThrow("JSON object");
  });

  test("non-object JSON (string) throws", () => {
    expect(() => parseExtOption('"hello"')).toThrow("JSON object");
  });

  test("invalid JSON throws with helpful message", () => {
    expect(() => parseExtOption("{bad}")).toThrow("Failed to parse --ext JSON");
  });
});

// ---------------------------------------------------------------------------
// autoDefaultForType
// ---------------------------------------------------------------------------

describe("autoDefaultForType", () => {
  test("void returns empty Uint8Array", () => {
    const result = autoDefaultForType({ type: "void" });
    expect(result).toBeInstanceOf(Uint8Array);
    expect((result as Uint8Array).length).toBe(0);
  });

  test("option returns undefined", () => {
    expect(
      autoDefaultForType({ type: "option", value: { type: "primitive", value: "u32" } }),
    ).toBeUndefined();
  });

  test("enum with Disabled variant returns Disabled", () => {
    const entry = {
      type: "enum",
      value: { Enabled: { type: "void" }, Disabled: { type: "void" } },
    };
    expect(autoDefaultForType(entry)).toEqual({ type: "Disabled", value: undefined });
  });

  test("enum without Disabled variant returns NO_DEFAULT", () => {
    const entry = { type: "enum", value: { Enabled: { type: "void" } } };
    expect(autoDefaultForType(entry)).toBe(NO_DEFAULT);
  });

  test("other types return NO_DEFAULT", () => {
    expect(autoDefaultForType({ type: "primitive", value: "u32" })).toBe(NO_DEFAULT);
    expect(autoDefaultForType({ type: "struct", value: {} })).toBe(NO_DEFAULT);
  });
});

// ---------------------------------------------------------------------------
// buildCustomSignedExtensions
// ---------------------------------------------------------------------------

describe("buildCustomSignedExtensions", () => {
  test("skips PAPI builtin extensions", () => {
    const result = buildCustomSignedExtensions(meta, {});
    expect(result).not.toHaveProperty("CheckNonce");
    expect(result).not.toHaveProperty("CheckMortality");
    expect(result).not.toHaveProperty("CheckWeight");
    expect(result).not.toHaveProperty("ChargeTransactionPayment");
  });

  test("returns empty for standard polkadot metadata (all extensions are builtins)", () => {
    const result = buildCustomSignedExtensions(meta, {});
    expect(Object.keys(result).length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// formatRawDecoded
// ---------------------------------------------------------------------------

describe("formatRawDecoded", () => {
  test("null and undefined return 'null'", () => {
    expect(formatRawDecoded(null)).toBe("null");
    expect(formatRawDecoded(undefined)).toBe("null");
  });

  test("primitives format correctly", () => {
    expect(formatRawDecoded("hello")).toBe("hello");
    expect(formatRawDecoded(42)).toBe("42");
    expect(formatRawDecoded(true)).toBe("true");
    expect(formatRawDecoded(false)).toBe("false");
  });

  test("bigint formats as string", () => {
    expect(formatRawDecoded(1000000000000n)).toBe("1000000000000");
  });

  test("Binary formats as hex", () => {
    expect(formatRawDecoded(Binary.fromHex("0xdeadbeef"))).toBe("0xdeadbeef");
  });

  test("empty array formats as []", () => {
    expect(formatRawDecoded([])).toBe("[]");
  });

  test("array of primitives formats correctly", () => {
    expect(formatRawDecoded([1, 2, 3])).toBe("[1, 2, 3]");
  });

  test("enum-like object with void value shows type only", () => {
    expect(formatRawDecoded({ type: "Unlimited", value: undefined })).toBe("Unlimited");
  });

  test("enum-like object with primitive value uses parens", () => {
    expect(formatRawDecoded({ type: "Parachain", value: 1000 })).toBe("Parachain(1000)");
  });

  test("enum-like object with struct value uses space", () => {
    expect(formatRawDecoded({ type: "AccountId32", value: { id: "0xabcd" } })).toBe(
      "AccountId32 { id: 0xabcd }",
    );
  });

  test("plain struct formats as { key: value }", () => {
    expect(formatRawDecoded({ parents: 0, interior: "Here" })).toBe(
      "{ parents: 0, interior: Here }",
    );
  });

  test("empty object formats as {}", () => {
    expect(formatRawDecoded({})).toBe("{}");
  });

  test("nested enum and struct combination", () => {
    const value = {
      type: "V3",
      value: { parents: 1, interior: { type: "Here", value: undefined } },
    };
    expect(formatRawDecoded(value)).toBe("V3 { parents: 1, interior: Here }");
  });

  test("array of enum-like objects", () => {
    const value = [
      { type: "Parachain", value: 1000 },
      { type: "AccountId32", value: { id: "0xab" } },
    ];
    expect(formatRawDecoded(value)).toBe("[Parachain(1000), AccountId32 { id: 0xab }]");
  });

  test("Binary inside nested structures", () => {
    const value = {
      type: "AccountId32",
      value: {
        id: Binary.fromHex("0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d"),
      },
    };
    const result = formatRawDecoded(value);
    expect(result).toContain("AccountId32");
    expect(result).toContain("0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d");
  });
});

// ---------------------------------------------------------------------------
// decodeCallFallback
// ---------------------------------------------------------------------------

describe("decodeCallFallback", () => {
  test("decodes System.remark call", () => {
    // Encode System.remark(0xdeadbeef) using buildCall
    const { codec, location } = meta.builder.buildCall("System", "remark");
    const callData = { remark: Binary.fromHex("0xdeadbeef") };
    const encodedArgs = codec.enc(callData);
    const fullCall = new Uint8Array([location[0], location[1], ...encodedArgs]);
    const callHex = Binary.fromBytes(fullCall).asHex();

    const result = decodeCallFallback(meta, callHex);
    expect(result).toContain("System");
    expect(result).toContain("remark");
    expect(result).toContain("0xdeadbeef");
  });

  test("decodes Balances.transfer_keep_alive call", () => {
    const { codec, location } = meta.builder.buildCall("Balances", "transfer_keep_alive");
    const callData = {
      dest: { type: "Id", value: "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty" },
      value: 1000000000000n,
    };
    const encodedArgs = codec.enc(callData);
    const fullCall = new Uint8Array([location[0], location[1], ...encodedArgs]);
    const callHex = Binary.fromBytes(fullCall).asHex();

    const result = decodeCallFallback(meta, callHex);
    expect(result).toContain("Balances");
    expect(result).toContain("transfer_keep_alive");
    expect(result).toContain("1000000000000");
  });

  test("decodes XcmPallet.teleport_assets call (complex types that crash view-builder)", () => {
    // This is the key test case — XCM calls crash view-builder's callDecoder
    const { codec, location } = meta.builder.buildCall("XcmPallet", "teleport_assets");
    const callData = {
      dest: {
        type: "V3",
        value: {
          parents: 0,
          interior: { type: "X1", value: { type: "Parachain", value: 1000 } },
        },
      },
      beneficiary: {
        type: "V3",
        value: {
          parents: 0,
          interior: {
            type: "X1",
            value: {
              type: "AccountId32",
              value: {
                network: undefined,
                id: Binary.fromHex(
                  "0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d",
                ),
              },
            },
          },
        },
      },
      assets: {
        type: "V3",
        value: [
          {
            id: { type: "Concrete", value: { parents: 0, interior: { type: "Here" } } },
            fun: { type: "Fungible", value: 1000000000000n },
          },
        ],
      },
      fee_asset_item: 0,
    };
    const encodedArgs = codec.enc(callData);
    const fullCall = new Uint8Array([location[0], location[1], ...encodedArgs]);
    const callHex = Binary.fromBytes(fullCall).asHex();

    const result = decodeCallFallback(meta, callHex);
    expect(result).toContain("XcmPallet");
    expect(result).toContain("teleport_assets");
    expect(result).toContain("Parachain(1000)");
    expect(result).toContain("AccountId32");
    expect(result).toContain("Fungible(1000000000000)");
  });

  test("decodes void-arg calls (no arguments)", () => {
    const { codec, location } = meta.builder.buildCall("Timestamp", "set");
    const callData = { now: 1000n };
    const encodedArgs = codec.enc(callData);
    const fullCall = new Uint8Array([location[0], location[1], ...encodedArgs]);
    const callHex = Binary.fromBytes(fullCall).asHex();

    const result = decodeCallFallback(meta, callHex);
    expect(result).toContain("Timestamp");
    expect(result).toContain("set");
  });

  test("throws on invalid hex", () => {
    expect(() => decodeCallFallback(meta, "0xff")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// sanitizeForSerialization
// ---------------------------------------------------------------------------

describe("sanitizeForSerialization", () => {
  test("converts Binary to hex string", () => {
    expect(sanitizeForSerialization(Binary.fromHex("0xdeadbeef"))).toBe("0xdeadbeef");
  });

  test("converts BigInt within safe range to number", () => {
    expect(sanitizeForSerialization(1000000000000n)).toBe(1000000000000);
  });

  test("converts BigInt outside safe range to string", () => {
    const big = BigInt(Number.MAX_SAFE_INTEGER) + 1n;
    expect(sanitizeForSerialization(big)).toBe(big.toString());
  });

  test("converts undefined to null", () => {
    expect(sanitizeForSerialization(undefined)).toBe(null);
  });

  test("passes through strings, numbers, booleans", () => {
    expect(sanitizeForSerialization("hello")).toBe("hello");
    expect(sanitizeForSerialization(42)).toBe(42);
    expect(sanitizeForSerialization(true)).toBe(true);
  });

  test("recursively processes objects", () => {
    const input = { a: Binary.fromHex("0xaa"), b: 100n };
    expect(sanitizeForSerialization(input)).toEqual({ a: "0xaa", b: 100 });
  });

  test("recursively processes arrays", () => {
    const input = [Binary.fromHex("0xbb"), 200n];
    expect(sanitizeForSerialization(input)).toEqual(["0xbb", 200]);
  });

  test("handles nested enum-like structures", () => {
    const input = { type: "Fungible", value: 1000000000000n };
    expect(sanitizeForSerialization(input)).toEqual({ type: "Fungible", value: 1000000000000 });
  });
});

// ---------------------------------------------------------------------------
// decodeCallToFileFormat
// ---------------------------------------------------------------------------

describe("decodeCallToFileFormat", () => {
  test("System.remark produces file-compatible object", () => {
    const { codec, location } = meta.builder.buildCall("System", "remark");
    const callData = { remark: Binary.fromHex("0xdeadbeef") };
    const encodedArgs = codec.enc(callData);
    const fullCall = new Uint8Array([location[0], location[1], ...encodedArgs]);
    const callHex = Binary.fromBytes(fullCall).asHex();

    const result = decodeCallToFileFormat(meta, callHex, "polkadot");
    expect(result.chain).toBe("polkadot");
    expect(result.tx).toBeDefined();
    const tx = result.tx as Record<string, any>;
    expect(tx.System).toBeDefined();
    expect(tx.System.remark).toBeDefined();
    expect(tx.System.remark.remark).toBe("0xdeadbeef");
  });

  test("Balances.transfer_keep_alive produces file-compatible object", () => {
    const { codec, location } = meta.builder.buildCall("Balances", "transfer_keep_alive");
    const callData = {
      dest: { type: "Id", value: "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty" },
      value: 1000000000000n,
    };
    const encodedArgs = codec.enc(callData);
    const fullCall = new Uint8Array([location[0], location[1], ...encodedArgs]);
    const callHex = Binary.fromBytes(fullCall).asHex();

    const result = decodeCallToFileFormat(meta, callHex, "polkadot");
    const tx = result.tx as Record<string, any>;
    expect(tx.Balances).toBeDefined();
    expect(tx.Balances.transfer_keep_alive).toBeDefined();
    expect(tx.Balances.transfer_keep_alive.dest.type).toBe("Id");
    expect(tx.Balances.transfer_keep_alive.value).toBe(1000000000000);
  });

  test("XCM call produces file-compatible object with enum structure", () => {
    const { codec, location } = meta.builder.buildCall("XcmPallet", "teleport_assets");
    const callData = {
      dest: {
        type: "V3",
        value: {
          parents: 0,
          interior: { type: "X1", value: { type: "Parachain", value: 1000 } },
        },
      },
      beneficiary: {
        type: "V3",
        value: {
          parents: 0,
          interior: {
            type: "X1",
            value: {
              type: "AccountId32",
              value: {
                network: undefined,
                id: Binary.fromHex(
                  "0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d",
                ),
              },
            },
          },
        },
      },
      assets: {
        type: "V3",
        value: [
          {
            id: { type: "Concrete", value: { parents: 0, interior: { type: "Here" } } },
            fun: { type: "Fungible", value: 1000000000000n },
          },
        ],
      },
      fee_asset_item: 0,
    };
    const encodedArgs = codec.enc(callData);
    const fullCall = new Uint8Array([location[0], location[1], ...encodedArgs]);
    const callHex = Binary.fromBytes(fullCall).asHex();

    const result = decodeCallToFileFormat(meta, callHex, "polkadot");
    const tx = result.tx as Record<string, any>;
    expect(tx.XcmPallet).toBeDefined();
    expect(tx.XcmPallet.teleport_assets).toBeDefined();
    expect(tx.XcmPallet.teleport_assets.dest.type).toBe("V3");
    expect(tx.XcmPallet.teleport_assets.assets.type).toBe("V3");
  });
});

// ---------------------------------------------------------------------------
// Layer 1: CLI integration tests (subprocess)
// ---------------------------------------------------------------------------

describe("dot tx CLI integration", () => {
  test("System.remark --encode outputs hex", async () => {
    const { stdout, exitCode } = await runCli(["tx.System.remark", "0xdeadbeef", "--encode"]);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^0x[0-9a-f]+$/);
  });

  test("encode round-trip: encode then decode", async () => {
    // Encode
    const { stdout: hex, exitCode } = await runCli(["tx.System.remark", "0xdeadbeef", "--encode"]);
    expect(exitCode).toBe(0);

    // The encoded hex should start with the System pallet index + remark call index
    // followed by the SCALE-encoded remark bytes.
    // We can verify it's valid by checking it's proper hex.
    expect(hex).toMatch(/^0x[0-9a-f]+$/);
    expect(hex.length).toBeGreaterThan(6); // at least pallet+call+length+data
  });

  test("--encode without --from succeeds", async () => {
    const { exitCode } = await runCli(["tx.System.remark", "0xaa", "--encode"]);
    expect(exitCode).toBe(0);
  });

  test("--encode --dry-run rejects", async () => {
    const { stderr, exitCode } = await runCli([
      "tx.System.remark",
      "0xaa",
      "--encode",
      "--dry-run",
      "--from",
      "alice",
    ]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("mutually exclusive");
  });

  test("--encode with raw hex tx.0x0001 rejects", async () => {
    const { stderr, exitCode } = await runCli(["tx.0x0001", "--encode"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("already encoded");
  });

  test("unknown pallet gives suggestion", async () => {
    const { stderr, exitCode } = await runCli(["tx.Systm.remark", "0xaa", "--encode"]);
    expect(exitCode).toBe(1);
    expect(stderr).toMatch(/System/i);
  });

  test("unknown call gives suggestion", async () => {
    const { stderr, exitCode } = await runCli(["tx.System.remrk", "0xaa", "--encode"]);
    expect(exitCode).toBe(1);
    expect(stderr).toMatch(/remark/i);
  });

  test("missing --from without --encode shows call help", async () => {
    const { stdout, exitCode } = await runCli(["tx.System.remark", "0xaa"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("(Call)");
    expect(stdout).toContain("Args:");
    expect(stdout).toContain("--from");
    expect(stdout).toContain("Usage:");
  });

  test("tx.System.remark --help shows call help", async () => {
    const { stdout, exitCode } = await runCli(["tx.System.remark", "--help"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("(Call)");
    expect(stdout).toContain("Args:");
    expect(stdout).toContain("Usage:");
    expect(stdout).toContain("--from");
    expect(stdout).toContain("--encode");
    expect(stdout).toContain("--dry-run");
  });

  test("--encode Balances.transfer_keep_alive produces valid hex", async () => {
    const { stdout, exitCode } = await runCli([
      "tx.Balances.transfer_keep_alive",
      "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty",
      "1000000000000",
      "--encode",
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^0x[0-9a-f]+$/);
    // Balances pallet index is 0x05 on Polkadot, transfer_keep_alive is 0x03
    expect(stdout.startsWith("0x0503")).toBe(true);
  });

  test("--encode with wrong arg count errors", async () => {
    const { stderr, exitCode } = await runCli(["tx.System.remark", "--encode"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("takes 1 argument");
  });

  test("--encode XcmPallet.teleport_assets with nested AccountId32 hex bytes (V5)", async () => {
    const dest =
      '{"type":"V5","value":{"parents":0,"interior":{"type":"X1","value":[{"type":"Parachain","value":1000}]}}}';
    const beneficiary =
      '{"type":"V5","value":{"parents":0,"interior":{"type":"X1","value":[{"type":"AccountId32","value":{"network":null,"id":"0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d"}}]}}}';
    const assets =
      '{"type":"V5","value":[{"id":{"parents":0,"interior":{"type":"Here"}},"fun":{"type":"Fungible","value":1000000000000}}]}';
    const { stdout, exitCode, stderr } = await runCli([
      "tx.XcmPallet.teleport_assets",
      dest,
      beneficiary,
      assets,
      "0",
      "--encode",
    ]);
    expect(stderr).toBe("");
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^0x[0-9a-f]+$/);
  });

  test("--encode XcmPallet.teleport_assets with quoted large Fungible value", async () => {
    const dest =
      '{"type":"V5","value":{"parents":0,"interior":{"type":"X1","value":[{"type":"Parachain","value":1000}]}}}';
    const beneficiary =
      '{"type":"V5","value":{"parents":0,"interior":{"type":"X1","value":[{"type":"AccountId32","value":{"network":null,"id":"0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d"}}]}}}';
    // String value for Fungible exceeding MAX_SAFE_INTEGER — tests primitive coercion
    const assets =
      '{"type":"V5","value":[{"id":{"parents":0,"interior":{"type":"Here"}},"fun":{"type":"Fungible","value":"100000000000000000"}}]}';
    const { stdout, exitCode, stderr } = await runCli([
      "tx.XcmPallet.teleport_assets",
      dest,
      beneficiary,
      assets,
      "0",
      "--encode",
    ]);
    expect(stderr).toBe("");
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^0x[0-9a-f]+$/);
  });

  test("--encode XcmPallet.teleport_assets with V3 format", async () => {
    const dest =
      '{"type":"V3","value":{"parents":0,"interior":{"type":"X1","value":[{"type":"Parachain","value":1000}]}}}';
    const beneficiary =
      '{"type":"V3","value":{"parents":0,"interior":{"type":"X1","value":[{"type":"AccountId32","value":{"network":null,"id":"0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d"}}]}}}';
    const assets =
      '{"type":"V3","value":[{"id":{"type":"Concrete","value":{"parents":0,"interior":{"type":"Here"}}},"fun":{"type":"Fungible","value":1000000000000}}]}';
    const { stdout, exitCode, stderr } = await runCli([
      "tx.XcmPallet.teleport_assets",
      dest,
      beneficiary,
      assets,
      "0",
      "--encode",
    ]);
    expect(stderr).toBe("");
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^0x[0-9a-f]+$/);
  });

  test("chain prefix --encode works (4-segment)", async () => {
    const { stdout, exitCode } = await runCli([
      "polkadot.tx.System.remark",
      "0xdeadbeef",
      "--encode",
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^0x[0-9a-f]+$/);
  });

  test("--encode Utility.dispatch_as with enum shorthand system(Authorized)", async () => {
    // First encode a remark to use as the call arg
    const { stdout: remarkHex } = await runCli(["tx.System.remark", "0xcafe", "--encode"]);

    // Use shorthand syntax for the OriginCaller enum
    const {
      stdout: shorthandHex,
      exitCode,
      stderr,
    } = await runCli(["tx.Utility.dispatch_as", "system(Authorized)", remarkHex, "--encode"]);
    expect(stderr).toBe("");
    expect(exitCode).toBe(0);
    expect(shorthandHex).toMatch(/^0x[0-9a-f]+$/);

    // Verify it produces the same output as the JSON format
    const { stdout: jsonHex } = await runCli([
      "tx.Utility.dispatch_as",
      '{"type":"system","value":{"type":"Authorized"}}',
      remarkHex,
      "--encode",
    ]);
    expect(shorthandHex).toBe(jsonHex);
  });

  test("chain prefix + --chain flag errors", async () => {
    const { stderr, exitCode } = await runCli([
      "polkadot.tx.System.remark",
      "0xaa",
      "--encode",
      "--chain",
      "polkadot",
    ]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Chain specified both as prefix");
  });

  test("contextual error for invalid struct arg via CLI", async () => {
    const { stderr, exitCode } = await runCli([
      "tx.Balances.transfer_keep_alive",
      "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
      "abc",
      "--encode",
    ]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Invalid value for argument 'value'");
    expect(stderr).toContain("expected");
  });

  test("dot tx.System shows pallet call listing via dot-path", async () => {
    const { stdout, exitCode } = await runCli(["tx.System"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("System Calls");
    expect(stdout).toContain("remark");
  });

  test("dot tx shows pallet list (category-only mode)", async () => {
    const { stdout, exitCode } = await runCli(["tx"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Pallets with calls");
    expect(stdout).toContain("System");
    expect(stdout).toContain("Balances");
  });

  test("raw hex via dot-path tx.0x rejects with --encode", async () => {
    const { stderr, exitCode } = await runCli(["tx.0x0001", "--encode"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("already encoded");
  });

  test("raw hex via dot-path tx.0x errors without --from", async () => {
    const { stderr, exitCode } = await runCli(["tx.0x0001"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("--from");
  });

  // --yaml / --json tests
  test("--yaml with named call outputs valid YAML", async () => {
    const { stdout, exitCode, stderr } = await runCli(["tx.System.remark", "0xdeadbeef", "--yaml"]);
    expect(stderr).toBe("");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("chain:");
    expect(stdout).toContain("tx:");
    expect(stdout).toContain("System:");
    expect(stdout).toContain("remark:");
  });

  test("--json with named call outputs valid JSON", async () => {
    const { stdout, exitCode, stderr } = await runCli(["tx.System.remark", "0xdeadbeef", "--json"]);
    expect(stderr).toBe("");
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.chain).toBeDefined();
    expect(parsed.tx.System.remark).toBeDefined();
  });

  test("--yaml with raw hex decodes correctly", async () => {
    // First encode a call to get valid hex
    const { stdout: hex } = await runCli(["tx.System.remark", "0xdeadbeef", "--encode"]);
    // Then decode with --yaml
    const { stdout, exitCode, stderr } = await runCli([`tx.${hex}`, "--yaml"]);
    expect(stderr).toBe("");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("System:");
    expect(stdout).toContain("remark:");
  });

  test("--json with raw hex decodes correctly", async () => {
    const { stdout: hex } = await runCli(["tx.System.remark", "0xdeadbeef", "--encode"]);
    const { stdout, exitCode, stderr } = await runCli([`tx.${hex}`, "--json"]);
    expect(stderr).toBe("");
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.tx.System.remark).toBeDefined();
  });

  test("--yaml and --encode are mutually exclusive", async () => {
    const { stderr, exitCode } = await runCli(["tx.System.remark", "0xaa", "--yaml", "--encode"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("mutually exclusive");
  });

  test("--json and --dry-run are mutually exclusive", async () => {
    const { stderr, exitCode } = await runCli([
      "tx.System.remark",
      "0xaa",
      "--json",
      "--dry-run",
      "--from",
      "alice",
    ]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("mutually exclusive");
  });

  test("--yaml and --json are mutually exclusive", async () => {
    const { stderr, exitCode } = await runCli(["tx.System.remark", "0xaa", "--yaml", "--json"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("mutually exclusive");
  });

  test("--yaml without --from succeeds (no signer needed)", async () => {
    const { exitCode } = await runCli(["tx.System.remark", "0xaa", "--yaml"]);
    expect(exitCode).toBe(0);
  });

  test("round-trip: encode → --yaml → file input → --encode produces same hex", async () => {
    // Step 1: Encode a call
    const { stdout: originalHex } = await runCli(["tx.System.remark", "0xdeadbeef", "--encode"]);
    expect(originalHex).toMatch(/^0x[0-9a-f]+$/);

    // Step 2: Decode to YAML
    const { stdout: yamlContent } = await runCli([`tx.${originalHex}`, "--yaml"]);

    // Step 3: Feed YAML back as file input with --encode
    const {
      stdout: roundTripHex,
      exitCode,
      stderr,
    } = await runCli(["{{HOME}}/decoded.yaml", "--encode"], {
      files: { "decoded.yaml": yamlContent },
    });
    expect(stderr).toBe("");
    expect(exitCode).toBe(0);
    expect(roundTripHex).toBe(originalHex);
  });

  test("round-trip: encode → --json → file input → --encode produces same hex", async () => {
    const { stdout: originalHex } = await runCli([
      "tx.Balances.transfer_keep_alive",
      "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty",
      "1000000000000",
      "--encode",
    ]);

    const { stdout: jsonContent } = await runCli([`tx.${originalHex}`, "--json"]);

    const {
      stdout: roundTripHex,
      exitCode,
      stderr,
    } = await runCli(["{{HOME}}/decoded.json", "--encode"], {
      files: { "decoded.json": jsonContent },
    });
    expect(stderr).toBe("");
    expect(exitCode).toBe(0);
    expect(roundTripHex).toBe(originalHex);
  });
});
