import type { Decoded } from "@polkadot-api/view-builder";
import { getViewBuilder } from "@polkadot-api/view-builder";
import type { TxEvent, TxFinalized } from "polkadot-api";
import { Binary } from "polkadot-api";
import { loadConfig, resolveChain } from "../config/store.ts";
import { primaryRpc } from "../config/types.ts";
import { resolveAccountSigner, toSs58 } from "../core/accounts.ts";
import { type ClientHandle, createChainClient } from "../core/client.ts";
import { papiLink, pjsAppsLink } from "../core/explorers.ts";
import type { Lookup, MetadataBundle } from "../core/metadata.ts";
import {
  describeCallArgs,
  describeType,
  findPallet,
  getOrFetchMetadata,
  getPalletNames,
  getSignedExtensions,
  listPallets,
} from "../core/metadata.ts";
import {
  BOLD,
  CYAN,
  DIM,
  firstSentence,
  GREEN,
  printHeading,
  printItem,
  RED,
  RESET,
  Spinner,
  YELLOW,
} from "../core/output.ts";
import { CliError } from "../utils/errors.ts";
import { suggestMessage } from "../utils/fuzzy-match.ts";
import { parseValue } from "../utils/parse-value.ts";
import { loadMeta, resolvePallet, showItemHelp } from "./focused-inspect.ts";

export async function handleTx(
  target: string | undefined,
  args: string[],
  opts: {
    chain?: string;
    rpc?: string;
    from?: string;
    dryRun?: boolean;
    encode?: boolean;
    output?: string;
    ext?: string;
  },
) {
  if (!target) {
    // List all pallets with call counts
    const config = await loadConfig();
    const { name: chainName, chain: chainConfig } = resolveChain(config, opts.chain);
    const meta = await loadMeta(chainName, chainConfig, opts.rpc);
    const pallets = listPallets(meta);
    const withCalls = pallets.filter((p) => p.calls.length > 0);
    printHeading(`Pallets with calls on ${chainName} (${withCalls.length})`);
    for (const p of withCalls) {
      printItem(p.name, `${p.calls.length} calls`);
    }
    console.log();
    return;
  }

  // Check if this is a raw hex call
  const isRawCall = /^0x[0-9a-fA-F]+$/.test(target);

  // Check if target is pallet-only (no dot, not hex)
  if (!isRawCall && target.indexOf(".") === -1) {
    // Listing mode: show calls in the pallet
    const config = await loadConfig();
    const { name: chainName, chain: chainConfig } = resolveChain(config, opts.chain);
    const meta = await loadMeta(chainName, chainConfig, opts.rpc);
    const pallet = resolvePallet(meta, target);

    if (pallet.calls.length === 0) {
      console.log(`No calls in ${pallet.name}.`);
      return;
    }
    printHeading(`${pallet.name} Calls`);
    for (const c of pallet.calls) {
      const callArgs = describeCallArgs(meta, pallet.name, c.name);
      console.log(`  ${CYAN}${c.name}${RESET}${DIM}${callArgs}${RESET}`);
      const summary = firstSentence(c.docs);
      if (summary) {
        console.log(`      ${DIM}${summary}${RESET}`);
      }
    }
    console.log();
    return;
  }

  if (!opts.from && !opts.encode) {
    if (isRawCall) {
      throw new Error("--from is required (or use --encode to output hex without signing)");
    }
    await showItemHelp("tx", target, opts);
    return;
  }

  if (opts.encode && opts.dryRun) {
    throw new Error("--encode and --dry-run are mutually exclusive");
  }

  if (opts.encode && isRawCall) {
    throw new Error("--encode cannot be used with raw call hex (already encoded)");
  }

  const config = await loadConfig();
  const effectiveChain: string | undefined = opts.chain;
  let pallet: string | undefined;
  let callName: string | undefined;

  if (!isRawCall) {
    // Parse Pallet.Call from the target
    const dotIdx = target.indexOf(".");
    pallet = target.slice(0, dotIdx);
    callName = target.slice(dotIdx + 1);
  }

  const { name: chainName, chain: chainConfig } = resolveChain(config, effectiveChain);

  const signer = opts.encode ? undefined : await resolveAccountSigner(opts.from!);

  let clientHandle: ClientHandle | undefined;

  if (!opts.encode) {
    clientHandle = await createChainClient(chainName, chainConfig, opts.rpc);
  }

  try {
    let meta: MetadataBundle;
    if (clientHandle) {
      meta = await getOrFetchMetadata(chainName, clientHandle);
    } else {
      try {
        meta = await getOrFetchMetadata(chainName);
      } catch {
        clientHandle = await createChainClient(chainName, chainConfig, opts.rpc);
        meta = await getOrFetchMetadata(chainName, clientHandle);
      }
    }

    // Build custom signed extensions for non-standard chains
    let unsafeApi: any;
    let txOptions: { customSignedExtensions: Record<string, any> } | undefined;

    if (!opts.encode) {
      const userExtOverrides = parseExtOption(opts.ext);
      const customSignedExtensions = buildCustomSignedExtensions(meta, userExtOverrides);
      txOptions =
        Object.keys(customSignedExtensions).length > 0 ? { customSignedExtensions } : undefined;
      unsafeApi = clientHandle?.client.getUnsafeApi();
    }

    let tx: any;
    let callHex: string;

    if (isRawCall) {
      if (args.length > 0) {
        throw new Error(
          "Extra arguments are not allowed when submitting a raw call hex.\n" +
            "Usage: dot tx 0x<call_hex> --from <account>",
        );
      }
      const callBinary = Binary.fromHex(target as `0x${string}`);
      tx = await (unsafeApi as any).txFromCallData(callBinary);
      callHex = target;
    } else {
      // Validate pallet
      const palletNames = getPalletNames(meta);
      const palletInfo = findPallet(meta, pallet!);
      if (!palletInfo) {
        throw new Error(suggestMessage("pallet", pallet!, palletNames));
      }

      // Validate call
      const callInfo = palletInfo.calls.find(
        (c) => c.name.toLowerCase() === callName!.toLowerCase(),
      );
      if (!callInfo) {
        const callNames = palletInfo.calls.map((c) => c.name);
        throw new Error(suggestMessage(`call in ${palletInfo.name}`, callName!, callNames));
      }

      // Parse args against metadata
      const callData = parseCallArgs(meta, palletInfo.name, callInfo.name, args);

      if (opts.encode) {
        const { codec, location } = meta.builder.buildCall(palletInfo.name, callInfo.name);
        const encodedArgs = codec.enc(callData);
        const fullCall = new Uint8Array([location[0], location[1], ...encodedArgs]);
        console.log(Binary.fromBytes(fullCall).asHex());
        return;
      }

      tx = (unsafeApi as any).tx[palletInfo.name][callInfo.name](callData);

      const encodedCall = await tx.getEncodedData();
      callHex = encodedCall.asHex();
    }

    // Decode for display (works for both paths)
    const decodedStr = decodeCall(meta, callHex);

    if (opts.dryRun) {
      const signerAddress = toSs58(signer!.publicKey);
      console.log(`  ${BOLD}Chain:${RESET}  ${chainName}`);
      console.log(`  ${BOLD}From:${RESET}   ${opts.from} (${signerAddress})`);
      console.log(`  ${BOLD}Call:${RESET}   ${callHex}`);
      console.log(`  ${BOLD}Decode:${RESET} ${decodedStr}`);

      try {
        const fees = await tx.getEstimatedFees(signer?.publicKey, txOptions);
        console.log(`  ${BOLD}Estimated fees:${RESET} ${fees}`);
      } catch (err: any) {
        console.log(`  ${BOLD}Estimated fees:${RESET} ${YELLOW}unable to estimate${RESET}`);
        console.log(`  ${DIM}${err.message ?? err}${RESET}`);
      }
      return;
    }

    const result = await watchTransaction(tx.signSubmitAndWatch(signer, txOptions));

    console.log();
    console.log(`  ${BOLD}Chain:${RESET}  ${chainName}`);
    console.log(`  ${BOLD}Call:${RESET}   ${callHex}`);
    console.log(`  ${BOLD}Decode:${RESET} ${decodedStr}`);
    console.log(`  ${BOLD}Tx:${RESET}     ${result.txHash}`);

    let dispatchErrorMsg: string | undefined;
    if (result.ok) {
      console.log(`  ${BOLD}Status:${RESET} ${GREEN}ok${RESET}`);
    } else {
      dispatchErrorMsg = formatDispatchError(result.dispatchError);
      console.log(`  ${BOLD}Status:${RESET} ${RED}dispatch error${RESET}`);
      console.log(`  ${BOLD}Error:${RESET}  ${dispatchErrorMsg}`);
    }

    if (result.events && result.events.length > 0) {
      console.log(`  ${BOLD}Events:${RESET}`);
      for (const event of result.events) {
        const name = `${CYAN}${event.type}${RESET}.${CYAN}${event.value?.type ?? ""}${RESET}`;
        const payload = event.value?.value;
        if (payload && typeof payload === "object") {
          const fields = Object.entries(payload)
            .map(([k, v]) => `${k}: ${formatEventValue(v)}`)
            .join(", ");
          console.log(`    ${name} { ${fields} }`);
        } else {
          console.log(`    ${name}`);
        }
      }
    }

    const rpcUrl = primaryRpc(opts.rpc ?? chainConfig.rpc);
    if (rpcUrl) {
      const blockHash = result.block.hash;
      console.log(`  ${BOLD}Explorer:${RESET}`);
      console.log(`    ${DIM}PolkadotJS${RESET}  ${pjsAppsLink(rpcUrl, blockHash)}`);
      console.log(`    ${DIM}PAPI${RESET}        ${papiLink(rpcUrl, blockHash)}`);
    }
    console.log();

    if (!result.ok) {
      throw new CliError(`Transaction dispatch error: ${dispatchErrorMsg}`);
    }
  } finally {
    clientHandle?.destroy();
  }
}

function formatDispatchError(err: { type: string; value?: unknown }): string {
  if (err.type === "Module" && err.value && typeof err.value === "object") {
    const mod = err.value as { type?: string; value?: unknown };
    if (mod.type) {
      const inner = mod.value as { type?: string } | undefined;
      if (inner && typeof inner === "object" && inner.type) {
        return `${mod.type}.${inner.type}`;
      }
      return mod.type;
    }
  }
  if (err.value !== undefined && err.value !== null) {
    const val = typeof err.value === "string" ? err.value : JSON.stringify(err.value);
    return `${err.type}: ${val}`;
  }
  return err.type;
}

function decodeCall(meta: MetadataBundle, callHex: string): string {
  // Primary: view-builder (nicely structured output)
  try {
    const viewBuilder = getViewBuilder(meta.lookup);
    const decoded = viewBuilder.callDecoder(callHex);
    const palletName = decoded.pallet.value.name;
    const callName = decoded.call.value.name;
    const argsStr = formatDecodedArgs(decoded.args.value);
    return `${palletName}.${callName}${argsStr}`;
  } catch {
    // Fallback: DynamicBuilder codec (handles XCM and other complex types)
  }
  try {
    return decodeCallFallback(meta, callHex);
  } catch {
    return "(unable to decode)";
  }
}

function decodeCallFallback(meta: MetadataBundle, callHex: string): string {
  const callTypeId = meta.lookup.call;
  if (callTypeId == null) throw new Error("No RuntimeCall type ID");
  const codec = meta.builder.buildDefinition(callTypeId);
  const decoded = codec.dec(Binary.fromHex(callHex as `0x${string}`).asBytes());
  // decoded is { type: "PalletName", value: { type: "call_name", value: { ...args } } }
  const palletName = decoded.type;
  const call = decoded.value;
  const callName = call.type;
  const args = call.value;
  if (args === undefined || args === null) {
    return `${palletName}.${callName}`;
  }
  const argsStr = formatRawDecoded(args);
  return `${palletName}.${callName} ${argsStr}`;
}

function formatRawDecoded(value: unknown): string {
  if (value === undefined || value === null) return "null";
  if (value instanceof Binary) return value.asHex();
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toString();
  if (typeof value === "boolean") return value.toString();
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return `[${value.map(formatRawDecoded).join(", ")}]`;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    // Enum-like: { type, value }
    if ("type" in obj && typeof obj.type === "string") {
      const inner = obj.value;
      if (inner === undefined || inner === null) return obj.type;
      const innerStr = formatRawDecoded(inner);
      // If inner formatted as struct "{ ... }", show Type { ... }
      if (innerStr.startsWith("{")) return `${obj.type} ${innerStr}`;
      return `${obj.type}(${innerStr})`;
    }
    // Plain struct
    const entries = Object.entries(obj);
    if (entries.length === 0) return "{}";
    const fields = entries.map(([k, v]) => `${k}: ${formatRawDecoded(v)}`).join(", ");
    return `{ ${fields} }`;
  }
  return String(value);
}

function formatDecodedArgs(decoded: { codec: string; value: any }): string {
  return formatDecoded(decoded as Decoded);
}

function formatDecoded(d: Decoded): string {
  switch (d.codec) {
    case "_void":
      return "";
    case "bool":
      return d.value.toString();
    case "str":
    case "char":
      return d.value;
    case "u8":
    case "u16":
    case "u32":
    case "i8":
    case "i16":
    case "i32":
    case "compactNumber":
      return d.value.toString();
    case "u64":
    case "u128":
    case "u256":
    case "i64":
    case "i128":
    case "i256":
    case "compactBn":
      return d.value.toString();
    case "bitSequence":
      return `0x${Buffer.from(d.value.bytes).toString("hex")}`;
    case "AccountId":
      return d.value.address;
    case "ethAccount":
      return d.value;
    case "Bytes":
      return d.value;
    case "BytesArray":
      return d.value;
    case "Enum": {
      const inner = formatDecoded(d.value.value);
      if (!inner) return d.value.type;
      return `${d.value.type}(${inner})`;
    }
    case "Struct": {
      const entries = Object.entries(d.value as Record<string, Decoded>);
      if (entries.length === 0) return " {}";
      const fields = entries.map(([k, v]) => `${k}: ${formatDecoded(v)}`).join(", ");
      return ` { ${fields} }`;
    }
    case "Tuple": {
      const items = (d.value as Decoded[]).map(formatDecoded).join(", ");
      return `(${items})`;
    }
    case "Option": {
      if (d.value.codec === "_void") return "None";
      return formatDecoded(d.value);
    }
    case "Result": {
      if (d.value.success) {
        return `Ok(${formatDecoded(d.value.value)})`;
      }
      return `Err(${formatDecoded(d.value.value)})`;
    }
    case "Sequence":
    case "Array": {
      const items = (d.value as Decoded[]).map(formatDecoded);
      if (items.length === 0) return "[]";
      return `[${items.join(", ")}]`;
    }
    default:
      return String((d as any).value ?? "");
  }
}

function formatEventValue(v: unknown): string {
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "string") return v;
  if (typeof v === "number") return v.toString();
  if (typeof v === "boolean") return v.toString();
  if (v === null || v === undefined) return "null";
  if (v instanceof Binary) {
    const text = v.asText();
    return text.includes("\uFFFD") ? v.asHex() : text;
  }
  return JSON.stringify(v, (_k, val) => (typeof val === "bigint" ? val.toString() : val));
}

function parseCallArgs(
  meta: MetadataBundle,
  palletName: string,
  callName: string,
  args: string[],
): unknown {
  // Look up the calls enum to find the variant's inner type
  const palletMeta = meta.unified.pallets.find((p) => p.name === palletName);
  if (!palletMeta?.calls) return undefined;

  const callsEntry = meta.lookup(palletMeta.calls.type);
  if (callsEntry.type !== "enum") return undefined;

  const variant = (callsEntry.value as Record<string, any>)[callName];
  if (!variant) return undefined;

  // Determine the fields based on variant type
  if (variant.type === "void") {
    if (args.length > 0) {
      throw new Error(`${palletName}.${callName} takes no arguments, but ${args.length} provided.`);
    }
    return undefined;
  }

  if (variant.type === "struct") {
    return parseStructArgs(meta, variant.value, args, `${palletName}.${callName}`);
  }

  if (variant.type === "lookupEntry") {
    const inner = variant.value;
    if (inner.type === "struct") {
      return parseStructArgs(meta, inner.value, args, `${palletName}.${callName}`);
    }
    if (inner.type === "void") return undefined;
    // Single arg
    if (args.length !== 1) {
      throw new Error(
        `${palletName}.${callName} takes 1 argument (${describeType(meta.lookup, inner.id)}), but ${args.length} provided.`,
      );
    }
    try {
      return parseTypedArg(meta, inner, args[0]!);
    } catch (err) {
      const typeDesc = describeType(meta.lookup, inner.id);
      throw new Error(
        `Invalid value for argument 0 (expected ${typeDesc}): ${JSON.stringify(args[0])}`,
        { cause: err },
      );
    }
  }

  if (variant.type === "tuple") {
    const entries = variant.value as any[];
    if (args.length !== entries.length) {
      throw new Error(
        `${palletName}.${callName} takes ${entries.length} arguments, but ${args.length} provided.`,
      );
    }
    return entries.map((entry: any, i: number) => {
      try {
        return parseTypedArg(meta, entry, args[i]!);
      } catch (err) {
        const typeDesc = describeType(meta.lookup, entry.id);
        throw new Error(
          `Invalid value for argument ${i} (expected ${typeDesc}): ${JSON.stringify(args[i])}`,
          { cause: err },
        );
      }
    });
  }

  // Fallback: parse all args generically
  return args.length === 0 ? undefined : args.map(parseValue);
}

function parseStructArgs(
  meta: MetadataBundle,
  fields: Record<string, any>,
  args: string[],
  callLabel: string,
): Record<string, unknown> {
  const fieldNames = Object.keys(fields);
  if (args.length !== fieldNames.length) {
    const expected = fieldNames
      .map((name) => `${name}: ${describeType(meta.lookup, fields[name].id)}`)
      .join(", ");
    throw new Error(
      `${callLabel} takes ${fieldNames.length} argument(s): ${expected}\n` +
        `  Got ${args.length} argument(s).`,
    );
  }
  const result: Record<string, unknown> = {};
  for (let i = 0; i < fieldNames.length; i++) {
    const name = fieldNames[i]!;
    const entry = fields[name];
    try {
      result[name] = parseTypedArg(meta, entry, args[i]!);
    } catch (err) {
      const typeDesc = describeType(meta.lookup, entry.id);
      throw new Error(
        `Invalid value for argument '${name}' (expected ${typeDesc}): ${JSON.stringify(args[i])}\n` +
          `  Hint: ${typeHint(entry, meta)}`,
        { cause: err },
      );
    }
  }
  return result;
}

function typeHint(entry: any, meta: MetadataBundle): string {
  const resolved = entry.type === "lookupEntry" ? entry.value : entry;
  switch (resolved.type) {
    case "enum": {
      const variants = Object.keys(resolved.value);
      if (variants.length <= 6) return `a variant: ${variants.join(" | ")}`;
      return `one of ${variants.length} variants (e.g. ${variants.slice(0, 3).join(", ")})`;
    }
    case "struct":
      return `a JSON object with fields: ${Object.keys(resolved.value).join(", ")}`;
    case "tuple":
      return "a JSON array";
    case "sequence":
    case "array":
      return "a JSON array or hex-encoded bytes";
    default:
      return describeType(meta.lookup, entry.id);
  }
}

/**
 * Recursively normalize a JSON value to match polkadot-api's metadata types.
 *
 * polkadot-api unwraps single-element fixed arrays (e.g. `[Junction; 1]` becomes
 * just `Junction`). XCM types like `Junctions::X1` are defined as `X1([Junction; 1])`
 * in the spec, so users naturally pass `{"type":"X1","value":[{...}]}`. This function
 * detects that mismatch — enum variant inner is NOT array/sequence but the provided
 * value IS a single-element array — and unwraps it.
 */
function normalizeValue(lookup: Lookup, entry: any, value: unknown): unknown {
  let resolved = entry;
  while (resolved.type === "lookupEntry") {
    resolved = resolved.value;
  }

  switch (resolved.type) {
    case "enum": {
      if (value !== null && typeof value === "object" && !Array.isArray(value) && "type" in value) {
        const enumValue = value as { type: string; value?: unknown };
        const variant = (resolved.value as Record<string, any>)[enumValue.type];
        if (variant) {
          let innerEntry = variant;
          while (innerEntry.type === "lookupEntry") {
            innerEntry = innerEntry.value;
          }

          let normalizedInner = enumValue.value;

          // Unwrap single-element array when inner type is not array/sequence
          if (
            innerEntry.type !== "array" &&
            innerEntry.type !== "sequence" &&
            innerEntry.type !== "void" &&
            Array.isArray(normalizedInner) &&
            normalizedInner.length === 1
          ) {
            normalizedInner = normalizedInner[0];
          }

          if (normalizedInner !== undefined && innerEntry.type !== "void") {
            normalizedInner = normalizeValue(lookup, innerEntry, normalizedInner);
          }

          return { type: enumValue.type, value: normalizedInner };
        }
      }
      return value;
    }

    case "struct": {
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        const fields = resolved.value as Record<string, any>;
        const result: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
          if (key in fields) {
            result[key] = normalizeValue(lookup, fields[key], val);
          } else {
            result[key] = val;
          }
        }
        return result;
      }
      return value;
    }

    case "array":
    case "sequence": {
      // Convert hex/text strings to Binary for byte arrays (Vec<u8>, [u8; N])
      let innerResolved = resolved.value;
      while (innerResolved.type === "lookupEntry") {
        innerResolved = innerResolved.value;
      }
      if (
        innerResolved.type === "primitive" &&
        innerResolved.value === "u8" &&
        typeof value === "string"
      ) {
        if (/^0x[0-9a-fA-F]*$/.test(value)) return Binary.fromHex(value as `0x${string}`);
        return Binary.fromText(value);
      }

      if (Array.isArray(value)) {
        const innerEntry = resolved.value;
        return value.map((item) => normalizeValue(lookup, innerEntry, item));
      }
      return value;
    }

    case "tuple": {
      if (Array.isArray(value)) {
        const entries = resolved.value as any[];
        return value.map((item, i) =>
          i < entries.length ? normalizeValue(lookup, entries[i], item) : item,
        );
      }
      return value;
    }

    case "option": {
      if (value !== null && value !== undefined) {
        return normalizeValue(lookup, resolved.value, value);
      }
      // polkadot-api uses undefined (not null) for Option::None
      return undefined;
    }

    case "primitive": {
      // Convert string values from JSON to proper primitive types
      if (typeof value === "string") {
        const prim = resolved.value as string;
        switch (prim) {
          case "bool":
            return value === "true";
          case "u64":
          case "u128":
          case "u256":
          case "i64":
          case "i128":
          case "i256":
            return BigInt(value);
          case "u8":
          case "u16":
          case "u32":
          case "i8":
          case "i16":
          case "i32":
            return parseInt(value, 10);
        }
      }
      return value;
    }

    case "compact": {
      // Convert string values from JSON to proper compact types
      if (typeof value === "string") {
        return resolved.isBig ? BigInt(value) : parseInt(value, 10);
      }
      return value;
    }

    default:
      return value;
  }
}

function parseEnumShorthand(arg: string): { variant: string; inner: string } | null {
  if (arg.startsWith("{") || arg.startsWith("[") || arg.startsWith("0x")) return null;
  const firstParen = arg.indexOf("(");
  if (firstParen === -1 || !arg.endsWith(")")) return null;
  const variant = arg.slice(0, firstParen);
  if (!/^[a-zA-Z_]\w*$/.test(variant)) return null;
  return { variant, inner: arg.slice(firstParen + 1, -1) };
}

function parseTypedArg(meta: MetadataBundle, entry: any, arg: string): unknown {
  // Resolve lookupEntry indirection
  if (entry.type === "lookupEntry") return parseTypedArg(meta, entry.value, arg);

  switch (entry.type) {
    case "primitive":
      return parsePrimitive(entry.value, arg);

    case "compact":
      return entry.isBig ? BigInt(arg) : parseInt(arg, 10);

    case "AccountId32":
    case "AccountId20":
      return arg; // polkadot-api handles SS58 decoding

    case "option": {
      if (arg === "null" || arg === "undefined" || arg === "none") {
        return undefined;
      }
      return parseTypedArg(meta, entry.value, arg);
    }

    case "enum": {
      // Hex-encoded RuntimeCall (e.g. from --encode output used with Sudo.sudo)
      if (
        /^0x[0-9a-fA-F]+$/.test(arg) &&
        meta.lookup.call != null &&
        entry.id === meta.lookup.call
      ) {
        const callCodec = meta.builder.buildDefinition(meta.lookup.call);
        return callCodec.dec(Binary.fromHex(arg as `0x${string}`).asBytes());
      }

      // Try JSON parse for complex enums like MultiAddress
      if (arg.startsWith("{")) {
        try {
          return normalizeValue(meta.lookup, entry, JSON.parse(arg));
        } catch {
          // fall through
        }
      }

      // Enum shorthand: Variant(value)
      const variants = Object.keys(entry.value);
      const shorthand = parseEnumShorthand(arg);
      if (shorthand) {
        const matched = variants.find((v) => v.toLowerCase() === shorthand.variant.toLowerCase());
        if (matched) {
          const variantDef = entry.value[matched];
          const resolvedDef = variantDef.type === "lookupEntry" ? variantDef.value : variantDef;
          if (resolvedDef.type === "void" || shorthand.inner === "") {
            return { type: matched };
          }
          const innerValue = parseTypedArg(meta, variantDef, shorthand.inner);
          return normalizeValue(meta.lookup, entry, { type: matched, value: innerValue });
        }
      }

      // Auto-wrap MultiAddress-like enums: if "Id" variant has AccountId32
      // inner type and the arg looks like an SS58 address, wrap automatically
      if (variants.includes("Id")) {
        const idVariant = entry.value.Id;
        const innerType = idVariant.type === "lookupEntry" ? idVariant.value : idVariant;
        if (innerType.type === "AccountId32" && !arg.startsWith("{")) {
          return { type: "Id", value: arg };
        }
      }

      // Simple variant name (e.g., "Id" for MultiAddress)
      const matched = variants.find((v) => v.toLowerCase() === arg.toLowerCase());
      if (matched) {
        const variant = entry.value[matched];
        if (variant.type === "void") {
          return { type: matched };
        }
      }
      return parseValue(arg);
    }

    case "sequence":
    case "array": {
      // Vec<u8> / [u8; N] -> Binary
      const inner = entry.value;
      if (inner.type === "primitive" && inner.value === "u8") {
        if (/^0x[0-9a-fA-F]*$/.test(arg)) return Binary.fromHex(arg as any);
        return Binary.fromText(arg);
      }
      // Try JSON array
      if (arg.startsWith("[")) {
        try {
          return normalizeValue(meta.lookup, entry, JSON.parse(arg));
        } catch {
          // fall through
        }
      }
      // Hex bytes
      if (/^0x[0-9a-fA-F]*$/.test(arg)) return Binary.fromHex(arg as any);
      return parseValue(arg);
    }

    case "struct":
      // Must be JSON
      if (arg.startsWith("{")) {
        try {
          return normalizeValue(meta.lookup, entry, JSON.parse(arg));
        } catch {
          // fall through
        }
      }
      return parseValue(arg);

    case "tuple":
      if (arg.startsWith("[")) {
        try {
          return normalizeValue(meta.lookup, entry, JSON.parse(arg));
        } catch {
          // fall through
        }
      }
      return parseValue(arg);

    default:
      return parseValue(arg);
  }
}

function parsePrimitive(prim: string, arg: string): string | number | bigint | boolean {
  switch (prim) {
    case "bool":
      return arg === "true";
    case "char":
    case "str":
      return arg;
    case "u8":
    case "u16":
    case "u32":
    case "i8":
    case "i16":
    case "i32":
      return parseInt(arg, 10);
    case "u64":
    case "u128":
    case "u256":
    case "i64":
    case "i128":
    case "i256":
      return BigInt(arg);
    default:
      return parseValue(arg) as any;
  }
}

// --- Custom signed extensions support ---

/** Extensions that polkadot-api handles internally */
const PAPI_BUILTIN_EXTENSIONS = new Set([
  "CheckNonZeroSender",
  "CheckSpecVersion",
  "CheckTxVersion",
  "CheckGenesis",
  "CheckMortality",
  "CheckNonce",
  "CheckWeight",
  "ChargeTransactionPayment",
  "ChargeAssetTxPayment",
  "CheckMetadataHash",
  "StorageWeightReclaim",
  "PrevalidateAttests",
]);

function parseExtOption(ext: string | undefined): Record<string, any> {
  if (!ext) return {};
  try {
    const parsed = JSON.parse(ext);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error('--ext must be a JSON object, e.g. \'{"ExtName":{"value":...}}\'');
    }
    return parsed;
  } catch (err: any) {
    if (err.message?.startsWith("--ext")) throw err;
    throw new Error(
      `Failed to parse --ext JSON: ${err.message}\n` +
        'Expected format: \'{"ExtName":{"value":...}}\'',
    );
  }
}

/** Sentinel value: type could not be auto-defaulted */
const NO_DEFAULT = Symbol("no-default");

function buildCustomSignedExtensions(
  meta: MetadataBundle,
  userOverrides: Record<string, any>,
): Record<string, { value?: any; additionalSigned?: any }> {
  const result: Record<string, { value?: any; additionalSigned?: any }> = {};
  const extensions = getSignedExtensions(meta);

  for (const ext of extensions) {
    if (PAPI_BUILTIN_EXTENSIONS.has(ext.identifier)) continue;

    // User override takes priority
    if (ext.identifier in userOverrides) {
      result[ext.identifier] = userOverrides[ext.identifier];
      continue;
    }

    // Auto-default based on type structure
    const valueEntry = meta.lookup(ext.type);
    const addEntry = meta.lookup(ext.additionalSigned);

    const value = autoDefaultForType(valueEntry);
    const add = autoDefaultForType(addEntry);

    if (value !== NO_DEFAULT || add !== NO_DEFAULT) {
      result[ext.identifier] = {
        ...(value !== NO_DEFAULT ? { value } : {}),
        ...(add !== NO_DEFAULT ? { additionalSigned: add } : {}),
      };
    }
    // If neither can be auto-defaulted, skip — polkadot-api will error
    // with a clear message about the missing extension
  }
  return result;
}

function autoDefaultForType(entry: any): any {
  if (entry.type === "void") return new Uint8Array([]);
  // Option<T> → undefined tells polkadot-api to encode as None (0x00)
  if (entry.type === "option") return undefined;
  if (entry.type === "enum") {
    // Look for a "Disabled" variant (e.g. VerifyMultiSignature)
    const variants = entry.value as Record<string, any>;
    if ("Disabled" in variants) {
      return { type: "Disabled", value: undefined };
    }
  }
  // Cannot auto-default
  return NO_DEFAULT;
}

// --- Progressive transaction tracking ---

function watchTransaction(observable: import("rxjs").Observable<TxEvent>): Promise<TxFinalized> {
  const spinner = new Spinner();
  return new Promise<TxFinalized>((resolve, reject) => {
    spinner.start("Signing...");
    observable.subscribe({
      next(event: TxEvent) {
        switch (event.type) {
          case "signed":
            spinner.succeed("Signed");
            console.log(`  ${BOLD}Tx:${RESET}     ${event.txHash}`);
            spinner.start("Broadcasting...");
            break;
          case "broadcasted":
            spinner.succeed("Broadcasted");
            spinner.start("In best block...");
            break;
          case "txBestBlocksState":
            if (event.found) {
              spinner.succeed(`In best block #${event.block.number}`);
              spinner.start("Finalizing...");
            } else {
              spinner.start("In best block...");
            }
            break;
          case "finalized":
            spinner.succeed(`Finalized in block #${event.block.number}`);
            resolve(event);
            break;
        }
      },
      error(err: unknown) {
        spinner.stop();
        reject(err);
      },
    });
  });
}

export {
  autoDefaultForType,
  buildCustomSignedExtensions,
  decodeCallFallback,
  formatDispatchError,
  formatEventValue,
  formatRawDecoded,
  NO_DEFAULT,
  normalizeValue,
  parseCallArgs,
  parseEnumShorthand,
  parseExtOption,
  parsePrimitive,
  parseStructArgs,
  parseTypedArg,
  typeHint,
};
