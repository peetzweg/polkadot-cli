import type { CAC } from "cac";
import { Binary } from "polkadot-api";
import { getViewBuilder } from "@polkadot-api/view-builder";
import type { Decoded } from "@polkadot-api/view-builder";
import { loadConfig, resolveChain } from "../config/store.ts";
import { createChainClient } from "../core/client.ts";
import {
  getOrFetchMetadata,
  getSignedExtensions,
  findPallet,
  getPalletNames,
  describeType,
} from "../core/metadata.ts";
import type { MetadataBundle, Lookup } from "../core/metadata.ts";
import { resolveAccountSigner, toSs58 } from "../core/accounts.ts";
import { parseTarget } from "../utils/parse-target.ts";
import { parseValue } from "../utils/parse-value.ts";
import { suggestMessage } from "../utils/fuzzy-match.ts";
import { BOLD, CYAN, DIM, GREEN, RESET, YELLOW } from "../core/output.ts";

export function registerTxCommand(cli: CAC) {
  cli
    .command("tx [target] [...args]", "Submit an extrinsic (e.g. Balances.transferKeepAlive <dest> <amount>)")
    .option("--from <name>", "Account to sign with (required)")
    .option("--dry-run", "Estimate fees without submitting")
    .option("--ext <json>", "Custom signed extension values as JSON, e.g. '{\"ExtName\":{\"value\":...}}'")

    .action(
      async (
        target: string | undefined,
        args: string[],
        opts: {
          chain?: string;
          rpc?: string;
          from?: string;
          dryRun?: boolean;
          output?: string;
          ext?: string;
        },
      ) => {
        if (!target || !opts.from) {
          console.log(
            "Usage: dot tx <Pallet.Call|0xCallHex> [...args] --from <account> [--dry-run]",
          );
          console.log("");
          console.log("Examples:");
          console.log(
            "  $ dot tx Balances.transferKeepAlive 5FHn... 1000000000000 --from alice",
          );
          console.log(
            "  $ dot tx System.remark 0xdeadbeef --from alice --dry-run",
          );
          console.log(
            "  $ dot tx 0x0001076465616462656566 --from alice",
          );
          return;
        }

        const isRawCall = /^0x[0-9a-fA-F]+$/.test(target);

        const config = await loadConfig();
        const { name: chainName, chain: chainConfig } = resolveChain(
          config,
          opts.chain,
        );

        const signer = await resolveAccountSigner(opts.from);

        const clientHandle = await createChainClient(
          chainName,
          chainConfig,
          opts.rpc,
        );

        try {
          const meta = await getOrFetchMetadata(chainName, clientHandle);

          // Build custom signed extensions for non-standard chains
          const userExtOverrides = parseExtOption(opts.ext);
          const customSignedExtensions = buildCustomSignedExtensions(
            meta,
            userExtOverrides,
          );
          const txOptions =
            Object.keys(customSignedExtensions).length > 0
              ? { customSignedExtensions }
              : undefined;

          const unsafeApi = clientHandle.client.getUnsafeApi();

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
            const { pallet, item: callName } = parseTarget(target);

            // Validate pallet
            const palletNames = getPalletNames(meta);
            const palletInfo = findPallet(meta, pallet);
            if (!palletInfo) {
              throw new Error(suggestMessage("pallet", pallet, palletNames));
            }

            // Validate call
            const callInfo = palletInfo.calls.find(
              (c) => c.name.toLowerCase() === callName.toLowerCase(),
            );
            if (!callInfo) {
              const callNames = palletInfo.calls.map((c) => c.name);
              throw new Error(
                suggestMessage(
                  `call in ${palletInfo.name}`,
                  callName,
                  callNames,
                ),
              );
            }

            // Parse args against metadata
            const callData = parseCallArgs(
              meta,
              palletInfo.name,
              callInfo.name,
              args,
            );

            tx = (unsafeApi as any).tx[palletInfo.name][callInfo.name](
              callData,
            );

            const encodedCall = await tx.getEncodedData();
            callHex = encodedCall.asHex();
          }

          // Decode for display (works for both paths)
          const decodedStr = decodeCall(meta, callHex);

          if (opts.dryRun) {
            const signerAddress = toSs58(signer.publicKey);
            console.log(`  ${BOLD}From:${RESET}   ${opts.from} (${signerAddress})`);
            console.log(`  ${BOLD}Call:${RESET}   ${callHex}`);
            console.log(`  ${BOLD}Decode:${RESET} ${decodedStr}`);

            try {
              const fees = await tx.getEstimatedFees(
                signer.publicKey,
                txOptions,
              );
              console.log(`  ${BOLD}Estimated fees:${RESET} ${fees}`);
            } catch (err: any) {
              console.log(
                `  ${BOLD}Estimated fees:${RESET} ${YELLOW}unable to estimate${RESET}`,
              );
              console.log(`  ${DIM}${err.message ?? err}${RESET}`);
            }
            return;
          }

          console.log("Signing and submitting...");
          const result = await tx.signAndSubmit(signer, txOptions);

          console.log();
          console.log(`  ${BOLD}Call:${RESET}   ${callHex}`);
          console.log(`  ${BOLD}Decode:${RESET} ${decodedStr}`);
          console.log(`  ${BOLD}Tx:${RESET}     ${result.txHash}`);
          if (result.block) {
            console.log(
              `  ${BOLD}Block:${RESET}  #${result.block.number} (${result.block.hash})`,
            );
          }

          if (result.dispatchError) {
            console.log(`  ${BOLD}Status:${RESET} ${YELLOW}dispatch error${RESET}`);
            console.log(
              `  ${BOLD}Error:${RESET}  ${result.dispatchError.type}${result.dispatchError.value ? ": " + JSON.stringify(result.dispatchError.value) : ""}`,
            );
          } else {
            console.log(`  ${BOLD}Status:${RESET} ${GREEN}ok${RESET}`);
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
          console.log();
        } finally {
          clientHandle.destroy();
        }
      },
    );
}

function decodeCall(meta: MetadataBundle, callHex: string): string {
  try {
    const viewBuilder = getViewBuilder(meta.lookup);
    const decoded = viewBuilder.callDecoder(callHex);
    const palletName = decoded.pallet.value.name;
    const callName = decoded.call.value.name;
    const argsStr = formatDecodedArgs(decoded.args.value);
    return `${palletName}.${callName}${argsStr}`;
  } catch {
    return "(unable to decode)";
  }
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
      const fields = entries
        .map(([k, v]) => `${k}: ${formatDecoded(v)}`)
        .join(", ");
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
  return JSON.stringify(v, (_k, val) =>
    typeof val === "bigint" ? val.toString() : val,
  );
}

function parseCallArgs(
  meta: MetadataBundle,
  palletName: string,
  callName: string,
  args: string[],
): unknown {
  // Look up the calls enum to find the variant's inner type
  const palletMeta = meta.unified.pallets.find(
    (p) => p.name === palletName,
  );
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
    return parseStructArgs(meta.lookup, variant.value, args, `${palletName}.${callName}`);
  }

  if (variant.type === "lookupEntry") {
    const inner = variant.value;
    if (inner.type === "struct") {
      return parseStructArgs(meta.lookup, inner.value, args, `${palletName}.${callName}`);
    }
    if (inner.type === "void") return undefined;
    // Single arg
    if (args.length !== 1) {
      throw new Error(
        `${palletName}.${callName} takes 1 argument (${describeType(meta.lookup, inner.id)}), but ${args.length} provided.`,
      );
    }
    return parseTypedArg(meta.lookup, inner, args[0]);
  }

  if (variant.type === "tuple") {
    const entries = variant.value as any[];
    if (args.length !== entries.length) {
      throw new Error(
        `${palletName}.${callName} takes ${entries.length} arguments, but ${args.length} provided.`,
      );
    }
    return entries.map((entry: any, i: number) => parseTypedArg(meta.lookup, entry, args[i]));
  }

  // Fallback: parse all args generically
  return args.length === 0 ? undefined : args.map(parseValue);
}

function parseStructArgs(
  lookup: Lookup,
  fields: Record<string, any>,
  args: string[],
  callLabel: string,
): Record<string, unknown> {
  const fieldNames = Object.keys(fields);
  if (args.length !== fieldNames.length) {
    const expected = fieldNames
      .map((name) => `${name}: ${describeType(lookup, fields[name].id)}`)
      .join(", ");
    throw new Error(
      `${callLabel} takes ${fieldNames.length} argument(s): ${expected}\n` +
        `  Got ${args.length} argument(s).`,
    );
  }
  const result: Record<string, unknown> = {};
  for (let i = 0; i < fieldNames.length; i++) {
    const name = fieldNames[i];
    const entry = fields[name];
    result[name] = parseTypedArg(lookup, entry, args[i]);
  }
  return result;
}

function parseTypedArg(lookup: Lookup, entry: any, arg: string): unknown {
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
      return parseTypedArg(lookup, entry.value, arg);
    }

    case "enum": {
      // Try JSON parse for complex enums like MultiAddress
      if (arg.startsWith("{")) {
        try {
          return JSON.parse(arg);
        } catch {
          // fall through
        }
      }

      // Auto-wrap MultiAddress-like enums: if "Id" variant has AccountId32
      // inner type and the arg looks like an SS58 address, wrap automatically
      const variants = Object.keys(entry.value);
      if (variants.includes("Id")) {
        const idVariant = entry.value["Id"];
        const innerType =
          idVariant.type === "lookupEntry" ? idVariant.value : idVariant;
        if (innerType.type === "AccountId32" && !arg.startsWith("{")) {
          return { type: "Id", value: arg };
        }
      }

      // Simple variant name (e.g., "Id" for MultiAddress)
      const matched = variants.find(
        (v) => v.toLowerCase() === arg.toLowerCase(),
      );
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
          return JSON.parse(arg);
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
          return JSON.parse(arg);
        } catch {
          // fall through
        }
      }
      return parseValue(arg);

    case "tuple":
      if (arg.startsWith("[")) {
        try {
          return JSON.parse(arg);
        } catch {
          // fall through
        }
      }
      return parseValue(arg);

    default:
      return parseValue(arg);
  }
}

function parsePrimitive(
  prim: string,
  arg: string,
): string | number | bigint | boolean {
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

function parseExtOption(
  ext: string | undefined,
): Record<string, any> {
  if (!ext) return {};
  try {
    const parsed = JSON.parse(ext);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("--ext must be a JSON object, e.g. '{\"ExtName\":{\"value\":...}}'");
    }
    return parsed;
  } catch (err: any) {
    if (err.message?.startsWith("--ext")) throw err;
    throw new Error(
      `Failed to parse --ext JSON: ${err.message}\n` +
        "Expected format: '{\"ExtName\":{\"value\":...}}'",
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
