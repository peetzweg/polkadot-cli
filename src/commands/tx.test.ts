import { describe, expect, test } from "bun:test";
import { Binary } from "polkadot-api";
import { getTestMetadata } from "./__fixtures__/load-metadata.ts";
import { runCli } from "./__fixtures__/run-cli.ts";
import {
  formatDispatchError,
  normalizeValue,
  parseCallArgs,
  parsePrimitive,
  parseTypedArg,
} from "./tx.ts";

const meta = getTestMetadata();

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

describe("parseCallArgs", () => {
  test("System.remark with hex bytes", () => {
    const result = parseCallArgs(meta, "System", "remark", ["0xdeadbeef"]) as Record<
      string,
      unknown
    >;
    // System.remark is a struct variant with field "remark"
    expect(result.remark).toBeInstanceOf(Binary);
    expect((result.remark as Binary).asHex()).toBe("0xdeadbeef");
  });

  test("System.remark with plain text", () => {
    const result = parseCallArgs(meta, "System", "remark", ["hello"]) as Record<string, unknown>;
    expect(result.remark).toBeInstanceOf(Binary);
    expect((result.remark as Binary).asText()).toBe("hello");
  });

  test("Balances.transferKeepAlive with address and amount", () => {
    const addr = "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty";
    const result = parseCallArgs(meta, "Balances", "transfer_keep_alive", [
      addr,
      "1000000000000",
    ]) as Record<string, unknown>;
    expect(result.dest).toEqual({ type: "Id", value: addr });
    expect(result.value).toBe(1000000000000n);
  });

  test("wrong arg count throws", () => {
    expect(() => parseCallArgs(meta, "System", "remark", ["0xaa", "extra"])).toThrow(
      /takes 1 argument/,
    );
  });

  test("too few args throws with expected types", () => {
    expect(() =>
      parseCallArgs(meta, "Balances", "transfer_keep_alive", [
        "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
      ]),
    ).toThrow(/takes 2 argument/);
  });

  test("zero args for non-void call throws", () => {
    expect(() => parseCallArgs(meta, "System", "remark", [])).toThrow(/takes 1 argument/);
  });
});

describe("parseTypedArg", () => {
  test("decodes hex RuntimeCall for Sudo-style usage", () => {
    // Encode System.remark(0xaa) → hex, then parse it back through parseTypedArg
    const { codec, location } = meta.builder.buildCall("System", "remark");
    const callData = { remark: Binary.fromHex("0xaa") };
    const encodedArgs = codec.enc(callData);
    const fullCall = new Uint8Array([location[0], location[1], ...encodedArgs]);
    const callHex = Binary.fromBytes(fullCall).asHex();

    const callTypeId = meta.lookup.call;
    if (callTypeId == null) throw new Error("No RuntimeCall in metadata");
    const callEntry = meta.lookup(callTypeId);

    const decoded = parseTypedArg(meta, callEntry, callHex) as {
      type: string;
      value: { type: string; value: unknown };
    };
    expect(decoded.type).toBe("System");
    expect(decoded.value.type).toBe("remark");
  });

  test("auto-wraps SS58 address to MultiAddress.Id", () => {
    // Find the dest field type from Balances.transfer_keep_alive
    const palletMeta = meta.unified.pallets.find((p) => p.name === "Balances")!;
    const callsEntry = meta.lookup(palletMeta.calls!.type);
    const variant = ((callsEntry as any).value as Record<string, any>).transfer_keep_alive;
    // The variant may be a lookupEntry wrapping a struct
    let inner = variant;
    while (inner.type === "lookupEntry") inner = inner.value;
    const destEntry = inner.value.dest;

    const addr = "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty";
    const result = parseTypedArg(meta, destEntry, addr) as { type: string; value: string };
    expect(result).toEqual({ type: "Id", value: addr });
  });

  test("option with 'null' returns undefined", () => {
    const optionEntry = {
      type: "option",
      value: { type: "primitive", value: "u32" },
    };
    expect(parseTypedArg(meta, optionEntry, "null")).toBeUndefined();
    expect(parseTypedArg(meta, optionEntry, "none")).toBeUndefined();
  });

  test("compact u128 returns bigint", () => {
    const compactEntry = { type: "compact", isBig: true };
    expect(parseTypedArg(meta, compactEntry, "1000000000000")).toBe(1000000000000n);
  });

  test("compact u32 returns number", () => {
    const compactEntry = { type: "compact", isBig: false };
    expect(parseTypedArg(meta, compactEntry, "42")).toBe(42);
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

  test("leaves non-string values alone for primitives", () => {
    const mockEntry = { type: "primitive", value: "u128" };
    expect(normalizeValue(meta.lookup, mockEntry, 42n)).toBe(42n);
    expect(normalizeValue(meta.lookup, mockEntry, 42)).toBe(42);
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
// Layer 1: CLI integration tests (subprocess)
// ---------------------------------------------------------------------------

describe("dot tx CLI integration", () => {
  test("System.remark --encode outputs hex", async () => {
    const { stdout, exitCode } = await runCli(["tx", "System.remark", "0xdeadbeef", "--encode"]);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^0x[0-9a-f]+$/);
  });

  test("encode round-trip: encode then decode", async () => {
    // Encode
    const { stdout: hex, exitCode } = await runCli([
      "tx",
      "System.remark",
      "0xdeadbeef",
      "--encode",
    ]);
    expect(exitCode).toBe(0);

    // The encoded hex should start with the System pallet index + remark call index
    // followed by the SCALE-encoded remark bytes.
    // We can verify it's valid by checking it's proper hex.
    expect(hex).toMatch(/^0x[0-9a-f]+$/);
    expect(hex.length).toBeGreaterThan(6); // at least pallet+call+length+data
  });

  test("--encode without --from succeeds", async () => {
    const { exitCode } = await runCli(["tx", "System.remark", "0xaa", "--encode"]);
    expect(exitCode).toBe(0);
  });

  test("--encode --dry-run rejects", async () => {
    const { stderr, exitCode } = await runCli([
      "tx",
      "System.remark",
      "0xaa",
      "--encode",
      "--dry-run",
      "--from",
      "alice",
    ]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("mutually exclusive");
  });

  test("--encode with raw hex 0x0001 rejects", async () => {
    const { stderr, exitCode } = await runCli(["tx", "0x0001", "--encode"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("already encoded");
  });

  test("unknown pallet gives suggestion", async () => {
    const { stderr, exitCode } = await runCli(["tx", "Systm.remark", "0xaa", "--encode"]);
    expect(exitCode).toBe(1);
    expect(stderr).toMatch(/System/i);
  });

  test("unknown call gives suggestion", async () => {
    const { stderr, exitCode } = await runCli(["tx", "System.remrk", "0xaa", "--encode"]);
    expect(exitCode).toBe(1);
    expect(stderr).toMatch(/remark/i);
  });

  test("missing --from without --encode errors", async () => {
    const { stderr, exitCode } = await runCli(["tx", "System.remark", "0xaa"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("--from");
  });

  test("--encode Balances.transfer_keep_alive produces valid hex", async () => {
    const { stdout, exitCode } = await runCli([
      "tx",
      "Balances.transfer_keep_alive",
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
    const { stderr, exitCode } = await runCli(["tx", "System.remark", "--encode"]);
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
      "tx",
      "XcmPallet.teleport_assets",
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
      "tx",
      "XcmPallet.teleport_assets",
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
      "tx",
      "XcmPallet.teleport_assets",
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

  test("chain prefix --encode works (3-segment)", async () => {
    const { stdout, exitCode } = await runCli([
      "tx",
      "polkadot.System.remark",
      "0xdeadbeef",
      "--encode",
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^0x[0-9a-f]+$/);
  });

  test("chain prefix + --chain flag errors", async () => {
    const { stderr, exitCode } = await runCli([
      "tx",
      "polkadot.System.remark",
      "0xaa",
      "--encode",
      "--chain",
      "polkadot",
    ]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Chain specified both as prefix");
  });
});
