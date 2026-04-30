import type { Lookup, MetadataBundle } from "./metadata.ts";
import { isTTY } from "./output.ts";

// ANSI escape codes — defined locally (not imported) so the `color: boolean`
// option, not TTY detection, is the single source of truth for whether
// to emit them.
const RESET = "\x1b[0m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const MAGENTA = "\x1b[35m";

export interface PrettyOpts {
  /**
   * Baseline column for multi-line output: closing brackets align here,
   * nested content goes at `indent + 2`. Also the column where the value
   * begins on the first line (unless `prefix` is set).
   */
  indent?: number;
  /**
   * Number of characters that already precede the value on the first line
   * (e.g. the call name `submit` before `(args)`). Used only for the
   * compact-or-expand width check; not for multi-line layout.
   */
  prefix?: number;
  /** Available terminal width. Defaults to `process.stdout.columns ?? 80`. */
  width?: number;
  /** Whether to emit ANSI color escapes. Defaults to `isTTY`. */
  color?: boolean;
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape stripping
const ANSI_RE = /\x1b\[[0-9;]*m/g;

/** Visible width of a string, ignoring ANSI escape sequences. */
export function visualWidth(s: string): number {
  return s.replace(ANSI_RE, "").length;
}

function paint(color: boolean, code: string, text: string): string {
  return color ? `${code}${text}${RESET}` : text;
}

function defaultWidth(): number {
  return process.stdout.columns ?? 80;
}

function resolveOpts(opts: PrettyOpts): Required<PrettyOpts> {
  return {
    indent: opts.indent ?? 0,
    prefix: opts.prefix ?? 0,
    width: opts.width ?? defaultWidth(),
    color: opts.color ?? isTTY,
  };
}

// ---------------------------------------------------------------------------
// Compact (single-line) rendering
// ---------------------------------------------------------------------------

function compactEntry(entry: any, color: boolean): string {
  if (!entry) return "";
  switch (entry.type) {
    case "primitive":
      return paint(color, YELLOW, entry.value);
    case "compact": {
      const inner = entry.isBig ? "u128" : "u64";
      return `${paint(color, MAGENTA, "Compact")}<${paint(color, YELLOW, inner)}>`;
    }
    case "AccountId32":
      return paint(color, GREEN, "AccountId32");
    case "bitSequence":
      return paint(color, MAGENTA, "BitSequence");
    case "sequence":
      return `${paint(color, MAGENTA, "Vec")}<${compactEntry(entry.value, color)}>`;
    case "array":
      return `[${compactEntry(entry.value, color)}; ${entry.len}]`;
    case "tuple":
      return `(${(entry.value as any[]).map((v) => compactEntry(v, color)).join(", ")})`;
    case "struct": {
      const fields = Object.entries(entry.value as Record<string, any>);
      if (fields.length === 0) return "{}";
      const inner = fields
        .map(([k, v]) => `${paint(color, CYAN, k)}: ${compactEntry(v, color)}`)
        .join(", ");
      return `{ ${inner} }`;
    }
    case "option":
      return `${paint(color, MAGENTA, "Option")}<${compactEntry(entry.value, color)}>`;
    case "result":
      return `${paint(color, MAGENTA, "Result")}<${compactEntry(entry.value.ok, color)}, ${compactEntry(entry.value.ko, color)}>`;
    case "enum": {
      const variants = Object.keys(entry.value);
      // Very large enums are always summarized — the pipe-separated form
      // would be unreadable. Anything below this threshold renders as
      // `A | B | C | ...` so the width-aware caller can decide whether to
      // keep that compact or expand it across lines.
      if (variants.length > ENUM_COMPACT_LIMIT) {
        return `enum(${variants.length} variants)`;
      }
      return variants.map((v) => paint(color, GREEN, v)).join(" | ");
    }
    case "void":
      return "()";
    case "lookupEntry":
      return compactEntry(entry.value, color);
    default:
      return "unknown";
  }
}

/** Beyond this many variants, an enum is always summarized as `enum(N variants)`. */
const ENUM_COMPACT_LIMIT = 24;

// ---------------------------------------------------------------------------
// Multi-line expansion
// ---------------------------------------------------------------------------

/**
 * Expand a Lookup entry to a (possibly multi-line) string.
 *
 * `indent` is the baseline column where multi-line content's closing bracket
 * aligns — its inner content goes at `indent + 2`. `prefix` is any text
 * already on the first line before the value (e.g. `"name: "` when this is
 * a struct field's value); it's added to the compact-fit budget but does
 * NOT shift the multi-line baseline.
 */
function expandEntry(
  entry: any,
  indent: number,
  width: number,
  color: boolean,
  prefix = 0,
): string {
  const compact = compactEntry(entry, color);
  if (visualWidth(compact) + indent + prefix <= width) return compact;

  switch (entry.type) {
    case "struct":
      return expandStruct(entry.value as Record<string, any>, indent, width, color);
    case "tuple":
      return expandTuple(entry.value as any[], indent, width, color);
    case "sequence":
      return wrapMultiline("Vec", "<", ">", entry.value, indent, width, color);
    case "array": {
      // Arrays are almost always [primitive; N]; if the element somehow
      // expands, just inline it — array length stays beside the element.
      const inner = expandEntry(entry.value, indent + 1, width, color);
      return `[${inner}; ${entry.len}]`;
    }
    case "option":
      return wrapMultiline("Option", "<", ">", entry.value, indent, width, color);
    case "result": {
      // Result<Ok, Ko> — expand each on its own line. Comma between Ok and Ko
      // is required (it's the generic type list), no trailing comma after Ko.
      const innerIndent = indent + 2;
      const padding = " ".repeat(innerIndent);
      const closePadding = " ".repeat(indent);
      const ok = expandEntry(entry.value.ok, innerIndent, width, color);
      const ko = expandEntry(entry.value.ko, innerIndent, width, color);
      return `${paint(color, MAGENTA, "Result")}<\n${padding}${ok},\n${padding}${ko}\n${closePadding}>`;
    }
    case "enum": {
      const variants = Object.keys(entry.value);
      if (variants.length > ENUM_COMPACT_LIMIT) return `enum(${variants.length} variants)`;
      return expandEnum(variants, indent, color);
    }
    case "lookupEntry":
      return expandEntry(entry.value, indent, width, color);
    default:
      return compact;
  }
}

function expandStruct(
  fields: Record<string, any>,
  indent: number,
  width: number,
  color: boolean,
): string {
  const entries = Object.entries(fields);
  if (entries.length === 0) return "{}";
  return renderFieldList(entries, "{", "}", indent, width, color);
}

function expandTuple(items: any[], indent: number, width: number, color: boolean): string {
  if (items.length === 0) return "()";
  const inner = " ".repeat(indent + 2);
  const close = " ".repeat(indent);
  const lines = items.map((v) => `${inner}${expandEntry(v, indent + 2, width, color)}`);
  return `(\n${lines.join(",\n")},\n${close})`;
}

/**
 * Render `Name<inner>` (e.g. Vec, Option) with the inner content on its own
 * line(s), so multi-line inner content has consistent indentation regardless
 * of how the outer line started.
 */
function wrapMultiline(
  name: string,
  open: string,
  close: string,
  inner: any,
  indent: number,
  width: number,
  color: boolean,
): string {
  const innerIndent = indent + 2;
  const padding = " ".repeat(innerIndent);
  const closePadding = " ".repeat(indent);
  const innerStr = expandEntry(inner, innerIndent, width, color);
  // No trailing comma — these are generics like Vec<T>, not field lists.
  return `${paint(color, MAGENTA, name)}${open}\n${padding}${innerStr}\n${closePadding}${close}`;
}

function expandEnum(variants: string[], indent: number, color: boolean): string {
  // Multi-line enum: first variant unindented, remainder prefixed with "| "
  // (so the column of variant names lines up with the first one).
  const prefix = `\n${" ".repeat(indent)}| `;
  const [first, ...rest] = variants;
  const head = paint(color, GREEN, first ?? "");
  if (rest.length === 0) return head;
  const tail = rest.map((v) => paint(color, GREEN, v)).join(prefix);
  return `${head}${prefix}${tail}`;
}

/**
 * Maximum padding width for field-name alignment. Beyond this, fields align
 * to the longest "short" name and longer names just use one space — keeps
 * deeply nested structures from cascading off the right edge.
 */
const ALIGN_PADDING_LIMIT = 16;

/**
 * Render a list of `name: type` fields wrapped in `open`/`close` brackets.
 * Field names are right-padded so all values line up in the same column when
 * the longest name fits within `ALIGN_PADDING_LIMIT`. Otherwise alignment is
 * skipped to avoid deep cascades.
 */
function renderFieldList(
  fields: Array<[string, any]>,
  open: string,
  close: string,
  indent: number,
  width: number,
  color: boolean,
): string {
  const innerIndent = indent + 2;
  const maxNameLen = Math.max(...fields.map(([k]) => k.length));
  const align = maxNameLen <= ALIGN_PADDING_LIMIT;
  const padTo = align ? maxNameLen : 0;
  const padding = " ".repeat(innerIndent);
  const closePadding = " ".repeat(indent);

  const lines = fields.map(([k, v]) => {
    const paddedName = align ? k.padEnd(padTo) : k;
    // First-line column where the value starts (after "  name: " prefix).
    const fieldPrefix = (align ? padTo : k.length) + 2;
    // Pass `innerIndent` as the multi-line baseline (closing bracket aligns
    // with the field name's column, not with the value's column), but use
    // `fieldPrefix` so the compact-fit check still accounts for the leading
    // `name: ` text on the first line.
    const value = expandEntry(v, innerIndent, width, color, fieldPrefix);
    return `${padding}${paint(color, CYAN, paddedName)}: ${value}`;
  });

  return `${open}\n${lines.join(",\n")},\n${closePadding}${close}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Pretty-print any Lookup entry (single-line if it fits, expanded otherwise). */
export function prettyType(entry: any, opts: PrettyOpts = {}): string {
  const { indent, prefix, width, color } = resolveOpts(opts);
  // Width-fit check uses indent + prefix; expansion uses indent.
  const compact = compactEntry(entry, color);
  if (visualWidth(compact) + indent + prefix <= width) return compact;
  return expandEntry(entry, indent, width, color);
}

/** Pretty-print a type by its lookup ID. */
export function prettyTypeById(lookup: Lookup, typeId: number, opts: PrettyOpts = {}): string {
  try {
    const entry = lookup(typeId);
    if (!entry || typeof (entry as any).type !== "string") return `type(${typeId})`;
    return prettyType(entry, opts);
  } catch {
    return `type(${typeId})`;
  }
}

/**
 * Pretty-print a call's argument list as `(name: type, ...)` — single-line if it
 * fits, multi-line with aligned names otherwise. Returns "" if the call is
 * unknown, "()" if it has no args.
 */
export function prettyCallArgs(
  meta: MetadataBundle,
  palletName: string,
  callName: string,
  opts: PrettyOpts = {},
): string {
  const fields = getCallFields(meta, palletName, callName);
  if (fields === null) return "";
  return renderArgsFromFields(fields, opts);
}

/**
 * Pretty-print an event's field list. Same shape as `prettyCallArgs`.
 */
export function prettyEventFields(
  meta: MetadataBundle,
  palletName: string,
  eventName: string,
  opts: PrettyOpts = {},
): string {
  const fields = getEventFields(meta, palletName, eventName);
  if (fields === null) return "";
  return renderArgsFromFields(fields, opts);
}

/**
 * Pretty-print runtime API method argument list, given the method's inputs as
 * `[{ name, type: typeId }, ...]`. Width-aware like the others.
 */
export function prettyRuntimeApiArgs(
  lookup: Lookup,
  inputs: Array<{ name: string; type: number }>,
  opts: PrettyOpts = {},
): string {
  if (inputs.length === 0) return "()";
  const namedFields: Array<[string, any]> = inputs.map((i) => {
    let entry: any;
    try {
      entry = lookup(i.type);
      if (!entry || typeof entry.type !== "string") entry = { type: "unknown" };
    } catch {
      entry = { type: "unknown" };
    }
    return [i.name, entry];
  });
  return renderArgsFromFields({ kind: "named", fields: namedFields }, opts);
}

// ---------------------------------------------------------------------------
// Internals: variant unwrapping (shared with describeCallArgs/EventFields)
// ---------------------------------------------------------------------------

type FieldList =
  | { kind: "void" }
  | { kind: "named"; fields: Array<[string, any]> }
  | { kind: "positional"; types: any[] }
  | { kind: "single"; type: any };

function unwrapVariant(variant: any): FieldList | null {
  if (!variant) return null;
  if (variant.type === "void") return { kind: "void" };
  if (variant.type === "struct") {
    return {
      kind: "named",
      fields: Object.entries(variant.value as Record<string, any>),
    };
  }
  if (variant.type === "tuple") {
    return { kind: "positional", types: variant.value as any[] };
  }
  if (variant.type === "lookupEntry") {
    const inner = variant.value;
    if (inner.type === "void") return { kind: "void" };
    if (inner.type === "struct") {
      return {
        kind: "named",
        fields: Object.entries(inner.value as Record<string, any>),
      };
    }
    return { kind: "single", type: inner };
  }
  return null;
}

function getCallFields(
  meta: MetadataBundle,
  palletName: string,
  callName: string,
): FieldList | null {
  try {
    const palletMeta = meta.unified.pallets.find((p) => p.name === palletName);
    if (!palletMeta?.calls) return null;
    const callsEntry = meta.lookup(palletMeta.calls.type) as any;
    if (callsEntry.type !== "enum") return null;
    const variant = (callsEntry.value as Record<string, any>)[callName];
    return unwrapVariant(variant);
  } catch {
    return null;
  }
}

function getEventFields(
  meta: MetadataBundle,
  palletName: string,
  eventName: string,
): FieldList | null {
  try {
    const palletMeta = meta.unified.pallets.find((p) => p.name === palletName);
    if (!palletMeta?.events) return null;
    const eventsEntry = meta.lookup(palletMeta.events.type) as any;
    if (eventsEntry.type !== "enum") return null;
    const variant = (eventsEntry.value as Record<string, any>)[eventName];
    return unwrapVariant(variant);
  } catch {
    return null;
  }
}

function renderArgsFromFields(fields: FieldList, opts: PrettyOpts): string {
  const { indent, prefix, width, color } = resolveOpts(opts);
  // Compact-fit budget includes any text already on the line before the value.
  const lead = indent + prefix;

  switch (fields.kind) {
    case "void":
      return "()";
    case "named": {
      const compact = `(${fields.fields
        .map(([k, v]) => `${paint(color, CYAN, k)}: ${compactEntry(v, color)}`)
        .join(", ")})`;
      if (visualWidth(compact) + lead <= width) return compact;
      return renderFieldList(fields.fields, "(", ")", indent, width, color);
    }
    case "positional": {
      const compact = `(${fields.types.map((t) => compactEntry(t, color)).join(", ")})`;
      if (visualWidth(compact) + lead <= width) return compact;
      const innerIndent = indent + 2;
      const padding = " ".repeat(innerIndent);
      const closePadding = " ".repeat(indent);
      const lines = fields.types.map(
        (t) => `${padding}${expandEntry(t, innerIndent, width, color)}`,
      );
      return `(\n${lines.join(",\n")},\n${closePadding})`;
    }
    case "single": {
      const compact = `(${compactEntry(fields.type, color)})`;
      if (visualWidth(compact) + lead <= width) return compact;
      const inner = expandEntry(fields.type, indent + 2, width, color);
      return `(\n${" ".repeat(indent + 2)}${inner},\n${" ".repeat(indent)})`;
    }
  }
}

// ---------------------------------------------------------------------------
// Compact-only helpers for backwards-compatible single-line output
// ---------------------------------------------------------------------------

/** Single-line, uncolored type string (drop-in replacement for old describeType). */
export function compactTypeString(entry: any): string {
  return compactEntry(entry, false);
}

/** Single-line, uncolored args string (drop-in replacement for old describeCallArgs). */
export function compactArgsString(fields: FieldList | null): string {
  if (fields === null) return "";
  switch (fields.kind) {
    case "void":
      return "()";
    case "named":
      return `(${fields.fields.map(([k, v]) => `${k}: ${compactEntry(v, false)}`).join(", ")})`;
    case "positional":
      return `(${fields.types.map((t) => compactEntry(t, false)).join(", ")})`;
    case "single":
      return `(${compactEntry(fields.type, false)})`;
  }
}

/** Re-exports so metadata.ts can build legacy strings without duplicating logic. */
export { getCallFields as _getCallFields, getEventFields as _getEventFields };
