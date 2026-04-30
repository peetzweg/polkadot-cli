import { describe, expect, test } from "bun:test";
import { getTestMetadata } from "../commands/__fixtures__/load-metadata.ts";
import type { Lookup, MetadataBundle } from "./metadata.ts";
import {
  compactTypeString,
  prettyCallArgs,
  prettyEventFields,
  prettyType,
  prettyTypeById,
  visualWidth,
} from "./pretty-type.ts";

const meta: MetadataBundle = getTestMetadata();

// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping ANSI for assertions
const ANSI = /\x1b\[[0-9;]*m/g;
const stripAnsi = (s: string) => s.replace(ANSI, "");

function findTypeId(lookup: Lookup, predicate: (entry: any) => boolean, maxScan = 500): number {
  for (let id = 0; id < maxScan; id++) {
    try {
      if (predicate(lookup(id))) return id;
    } catch {}
  }
  throw new Error("type not found");
}

const u32Id = findTypeId(meta.lookup, (e) => e.type === "primitive" && e.value === "u32");
const accountIdId = findTypeId(meta.lookup, (e) => e.type === "AccountId32");
const smallEnumId = findTypeId(
  meta.lookup,
  (e) => e.type === "enum" && Object.keys(e.value).length > 0 && Object.keys(e.value).length <= 4,
);
// Large enums (>24 variants) collapse to `enum(N variants)` in the compact form.
const largeEnumId = findTypeId(
  meta.lookup,
  (e) => e.type === "enum" && Object.keys(e.value).length > 24,
  2000,
);
const seqId = findTypeId(meta.lookup, (e) => e.type === "sequence");
const optionId = findTypeId(meta.lookup, (e) => e.type === "option");
const structId = findTypeId(
  meta.lookup,
  (e) => e.type === "struct" && Object.keys(e.value).length >= 3,
);

// ---------------------------------------------------------------------------
// visualWidth
// ---------------------------------------------------------------------------
describe("visualWidth", () => {
  test("counts plain characters", () => {
    expect(visualWidth("hello")).toBe(5);
  });

  test("ignores ANSI escape codes", () => {
    expect(visualWidth("\x1b[36mhello\x1b[0m")).toBe(5);
  });

  test("ignores nested escapes", () => {
    expect(visualWidth("\x1b[1m\x1b[36mfoo\x1b[0m bar\x1b[0m")).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// prettyType — compact behavior matches legacy describeType
// ---------------------------------------------------------------------------
describe("prettyType — compact (width: Infinity)", () => {
  const opts = { width: Infinity, color: false };

  test("primitive u32", () => {
    expect(prettyType(meta.lookup(u32Id), opts)).toBe("u32");
  });

  test("AccountId32", () => {
    expect(prettyType(meta.lookup(accountIdId), opts)).toBe("AccountId32");
  });

  test("small enum is pipe-separated", () => {
    const result = prettyType(meta.lookup(smallEnumId), opts);
    expect(result).toContain(" | ");
    expect(result.split(" | ").length).toBeLessThanOrEqual(4);
  });

  test("large enum summarized", () => {
    const result = prettyType(meta.lookup(largeEnumId), opts);
    expect(result).toMatch(/^enum\(\d+ variants\)$/);
  });

  test("Vec wraps inner type", () => {
    expect(prettyType(meta.lookup(seqId), opts)).toMatch(/^Vec<.+>$/);
  });

  test("Option wraps inner type", () => {
    expect(prettyType(meta.lookup(optionId), opts)).toMatch(/^Option<.+>$/);
  });

  test("compactTypeString matches prettyType with width=Infinity, color=false", () => {
    for (const id of [u32Id, accountIdId, smallEnumId, largeEnumId, seqId, optionId, structId]) {
      expect(prettyType(meta.lookup(id), opts)).toBe(compactTypeString(meta.lookup(id)));
    }
  });
});

// ---------------------------------------------------------------------------
// prettyType — width-aware expansion
// ---------------------------------------------------------------------------
describe("prettyType — width-aware expansion", () => {
  test("short signature stays compact even at narrow width", () => {
    // u32 always fits — must never expand
    const result = prettyType(meta.lookup(u32Id), { width: 10, color: false });
    expect(result).toBe("u32");
    expect(result).not.toContain("\n");
  });

  test("struct expands when wider than available width", () => {
    const entry = meta.lookup(structId);
    // Force expansion with a tiny width
    const result = prettyType(entry, { width: 10, color: false, indent: 0 });
    expect(result).toContain("\n");
    expect(result.startsWith("{")).toBe(true);
    expect(result.endsWith("}")).toBe(true);
  });

  test("struct stays compact when wide enough", () => {
    const result = prettyType(meta.lookup(structId), { width: 1000, color: false });
    expect(result).not.toContain("\n");
  });

  test("expanded struct field names are aligned", () => {
    // Synthetic struct with fields of different lengths
    const entry = {
      type: "struct",
      value: {
        a: { type: "primitive", value: "u8" },
        longer_name: { type: "primitive", value: "u32" },
        x: { type: "primitive", value: "bool" },
      },
    };
    const result = prettyType(entry, { width: 20, color: false });
    // All field-value separators (": ") should be at the same column
    const lines = result.split("\n").filter((l) => l.includes(":"));
    const colonCols = lines.map((l) => l.indexOf(":"));
    expect(new Set(colonCols).size).toBe(1);
  });

  test("medium-sized enum (5-24 variants) renders pipe-separated, not summary", () => {
    // Synthetic: 8-variant enum
    const entry = {
      type: "enum",
      value: {
        Family: { type: "void" },
        Person: { type: "void" },
        Identity: { type: "void" },
        Squad: { type: "void" },
        Mob: { type: "void" },
        Group: { type: "void" },
        Tribe: { type: "void" },
        Clan: { type: "void" },
      },
    };
    const result = prettyType(entry, { width: 200, color: false });
    expect(result).not.toMatch(/^enum\(/);
    expect(result).toContain("Family | Person");
    expect(result.split(" | ").length).toBe(8);
  });

  test("medium enum expands one-per-line when too wide", () => {
    const entry = {
      type: "enum",
      value: Object.fromEntries(
        Array.from({ length: 8 }, (_, i) => [`Variant${i}`, { type: "void" }]),
      ),
    };
    const result = prettyType(entry, { width: 30, color: false });
    expect(result).toContain("\n");
    expect(result).toContain("Variant0");
    expect(result).toContain("Variant7");
    // Should use the | continuation prefix on each subsequent line
    expect(result).toMatch(/\n\s*\|\s+Variant1/);
  });

  test("very large enum (>24 variants) is summarized as enum(N variants)", () => {
    const entry = {
      type: "enum",
      value: Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`V${i}`, { type: "void" }])),
    };
    const result = prettyType(entry, { width: 200, color: false });
    expect(result).toMatch(/^enum\(30 variants\)$/);
  });

  test("nested struct stays compact when its line still fits", () => {
    const entry = {
      type: "struct",
      value: {
        outer_a: { type: "primitive", value: "u32" },
        nested: {
          type: "struct",
          value: {
            x: { type: "primitive", value: "u8" },
            y: { type: "primitive", value: "u8" },
          },
        },
      },
    };
    // Wide enough that the OUTER expands but the INNER stays compact
    const result = prettyType(entry, { width: 40, color: false });
    expect(result).toContain("\n");
    // Inner struct should remain on one line (name padded to align with longer sibling)
    expect(result).toMatch(/nested\s*:\s+\{ x: u8, y: u8 \}/);
  });
});

// ---------------------------------------------------------------------------
// Color suppression
// ---------------------------------------------------------------------------
describe("prettyType — color", () => {
  test("color: false produces no ANSI escapes", () => {
    const result = prettyType(meta.lookup(structId), { color: false, width: Infinity });
    expect(result).not.toMatch(ANSI);
  });

  test("color: true emits ANSI escapes", () => {
    const result = prettyType(meta.lookup(structId), { color: true, width: Infinity });
    expect(result).toMatch(ANSI);
  });

  test("stripping ANSI from colored output equals plain output", () => {
    const colored = prettyType(meta.lookup(structId), { color: true, width: Infinity });
    const plain = prettyType(meta.lookup(structId), { color: false, width: Infinity });
    expect(stripAnsi(colored)).toBe(plain);
  });
});

// ---------------------------------------------------------------------------
// prettyTypeById
// ---------------------------------------------------------------------------
describe("prettyTypeById", () => {
  test("falls back to type(id) for invalid lookup", () => {
    expect(prettyTypeById(meta.lookup, 999999, { color: false })).toBe("type(999999)");
  });

  test("delegates to prettyType for valid id", () => {
    expect(prettyTypeById(meta.lookup, u32Id, { color: false, width: Infinity })).toBe("u32");
  });
});

// ---------------------------------------------------------------------------
// prettyCallArgs
// ---------------------------------------------------------------------------
describe("prettyCallArgs", () => {
  const opts = { color: false, width: Infinity };

  test("returns () for void calls or '(...)' for known calls", () => {
    const result = prettyCallArgs(meta, "System", "remark", opts);
    expect(result.startsWith("(")).toBe(true);
    expect(result.endsWith(")")).toBe(true);
  });

  test("Balances.transfer_allow_death has named fields", () => {
    const result = prettyCallArgs(meta, "Balances", "transfer_allow_death", opts);
    expect(result).toContain("dest");
    expect(result).toContain("value");
  });

  test("returns empty string for nonexistent pallet", () => {
    expect(prettyCallArgs(meta, "NonExistent", "foo", opts)).toBe("");
  });

  test("returns empty string for nonexistent call", () => {
    expect(prettyCallArgs(meta, "System", "nonexistent_call", opts)).toBe("");
  });

  test("expands across multiple lines at narrow width", () => {
    const result = prettyCallArgs(meta, "Balances", "transfer_allow_death", {
      color: false,
      width: 30,
    });
    expect(result).toContain("\n");
    expect(result.startsWith("(")).toBe(true);
    expect(result.endsWith(")")).toBe(true);
  });

  test("compact form has no newlines when width is plentiful", () => {
    const result = prettyCallArgs(meta, "Balances", "transfer_allow_death", opts);
    expect(result).not.toContain("\n");
  });

  test("expanded args are name-aligned", () => {
    const result = prettyCallArgs(meta, "Balances", "transfer_allow_death", {
      color: false,
      width: 30,
    });
    const innerLines = result
      .split("\n")
      .filter((l) => l.includes(":") && !l.startsWith("(") && !l.startsWith(")"));
    if (innerLines.length > 1) {
      const cols = innerLines.map((l) => l.indexOf(":"));
      expect(new Set(cols).size).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------------
// prettyRuntimeApiArgs
// ---------------------------------------------------------------------------
describe("prettyRuntimeApiArgs", () => {
  test("returns () for no inputs", async () => {
    const { prettyRuntimeApiArgs } = await import("./pretty-type.ts");
    expect(prettyRuntimeApiArgs(meta.lookup, [], { color: false })).toBe("()");
  });

  test("formats single input compactly", async () => {
    const { prettyRuntimeApiArgs } = await import("./pretty-type.ts");
    const result = prettyRuntimeApiArgs(meta.lookup, [{ name: "id", type: u32Id }], {
      color: false,
      width: Infinity,
    });
    expect(result).toBe("(id: u32)");
  });

  test("expands multiple inputs to multi-line at narrow width", async () => {
    const { prettyRuntimeApiArgs } = await import("./pretty-type.ts");
    const result = prettyRuntimeApiArgs(
      meta.lookup,
      [
        { name: "first", type: u32Id },
        { name: "second", type: u32Id },
        { name: "third", type: u32Id },
      ],
      { color: false, width: 20 },
    );
    expect(result).toContain("\n");
    expect(result).toContain("first");
    expect(result).toContain("second");
    expect(result).toContain("third");
  });

  test("handles invalid type ids without throwing", async () => {
    const { prettyRuntimeApiArgs } = await import("./pretty-type.ts");
    const result = prettyRuntimeApiArgs(meta.lookup, [{ name: "broken", type: 999999 }], {
      color: false,
      width: Infinity,
    });
    expect(result.startsWith("(")).toBe(true);
    expect(result.endsWith(")")).toBe(true);
    expect(result).toContain("broken");
  });
});

// ---------------------------------------------------------------------------
// PrettyOpts: prefix vs indent semantics
// ---------------------------------------------------------------------------
describe("PrettyOpts", () => {
  test("prefix is added to width-fit budget — value stays compact when small", async () => {
    // A 70-char compact form fits at indent=2 + prefix=0 (lead=2, 72<=80)
    const fields = Array.from({ length: 5 }, (_, i) => ({
      name: `f${i}`,
      type: u32Id,
    }));
    const { prettyRuntimeApiArgs } = await import("./pretty-type.ts");
    const noPrefix = prettyRuntimeApiArgs(meta.lookup, fields, {
      indent: 2,
      prefix: 0,
      width: 80,
      color: false,
    });
    const withLargePrefix = prettyRuntimeApiArgs(meta.lookup, fields, {
      indent: 2,
      prefix: 70,
      width: 80,
      color: false,
    });
    // Same args, but a larger prefix forces expansion sooner
    expect(noPrefix.includes("\n")).toBe(false);
    expect(withLargePrefix.includes("\n")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// prettyEventFields
// ---------------------------------------------------------------------------
describe("prettyEventFields", () => {
  const opts = { color: false, width: Infinity };

  test("returns string starting with '(' for known events", () => {
    // System.ExtrinsicSuccess is a well-known event
    const result = prettyEventFields(meta, "System", "ExtrinsicSuccess", opts);
    expect(result.startsWith("(")).toBe(true);
    expect(result.endsWith(")")).toBe(true);
  });

  test("returns empty string for unknown event", () => {
    expect(prettyEventFields(meta, "System", "NoSuchEvent", opts)).toBe("");
  });
});
