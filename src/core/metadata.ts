import { getDynamicBuilder, getLookupFn } from "@polkadot-api/metadata-builders";
import { decAnyMetadata, unifyMetadata } from "@polkadot-api/substrate-bindings";
import { loadMetadata, saveMetadata } from "../config/store.ts";
import { ConnectionError, MetadataError } from "../utils/errors.ts";
import type { ClientHandle } from "./client.ts";

const METADATA_TIMEOUT_MS = 15_000;

export interface PalletInfo {
  name: string;
  index: number;
  docs: string[];
  storage: StorageItemInfo[];
  constants: ConstantInfo[];
  calls: CallInfo[];
}

export interface StorageItemInfo {
  name: string;
  docs: string[];
  type: "plain" | "map";
  keyTypeId: number | null;
  valueTypeId: number;
}

export interface ConstantInfo {
  name: string;
  docs: string[];
  typeId: number;
}

export interface CallInfo {
  name: string;
  docs: string[];
  typeId: number | null; // lookup ID for the call variant's inner type
}

export type UnifiedMeta = ReturnType<typeof unifyMetadata>;
export type Lookup = ReturnType<typeof getLookupFn>;
export type DynamicBuilder = ReturnType<typeof getDynamicBuilder>;

export interface MetadataBundle {
  unified: UnifiedMeta;
  lookup: Lookup;
  builder: DynamicBuilder;
}

export function parseMetadata(raw: Uint8Array): MetadataBundle {
  const decoded = decAnyMetadata(raw);
  const unified = unifyMetadata(decoded);
  const lookup = getLookupFn(unified);
  const builder = getDynamicBuilder(lookup);
  return { unified, lookup, builder };
}

export async function fetchMetadataFromChain(
  clientHandle: ClientHandle,
  chainName: string,
): Promise<Uint8Array> {
  const { client } = clientHandle;

  try {
    const hex = await Promise.race([
      client._request<string>("state_getMetadata", []),
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new ConnectionError(
                `Timed out fetching metadata for "${chainName}" after ${METADATA_TIMEOUT_MS / 1000}s. ` +
                  "Check that the RPC endpoint is correct and reachable.",
              ),
            ),
          METADATA_TIMEOUT_MS,
        ),
      ),
    ]);
    const bytes = hexToBytes(hex);
    await saveMetadata(chainName, bytes);
    return bytes;
  } catch (err) {
    if (err instanceof ConnectionError) throw err;
    throw new ConnectionError(
      `Failed to fetch metadata for "${chainName}": ${err instanceof Error ? err.message : err}. ` +
        "Check that the RPC endpoint is correct and reachable.",
    );
  }
}

export async function getOrFetchMetadata(
  chainName: string,
  clientHandle?: ClientHandle,
): Promise<MetadataBundle> {
  let raw = await loadMetadata(chainName);

  if (!raw) {
    if (!clientHandle) {
      throw new MetadataError(
        `No cached metadata for chain "${chainName}". Run a command that connects to the chain first, ` +
          `e.g.: dot chain add ${chainName} --rpc <url>`,
      );
    }
    raw = await fetchMetadataFromChain(clientHandle, chainName);
  }

  return parseMetadata(raw);
}

export function listPallets(meta: MetadataBundle): PalletInfo[] {
  return meta.unified.pallets.map((p) => ({
    name: p.name,
    index: p.index,
    docs: p.docs ?? [],
    storage: (p.storage?.items ?? []).map((s) => ({
      name: s.name,
      docs: s.docs ?? [],
      type: s.type.tag,
      keyTypeId: s.type.tag === "map" ? s.type.value.key : null,
      valueTypeId: s.type.tag === "plain" ? s.type.value : s.type.value.value,
    })),
    constants: (p.constants ?? []).map((c) => ({
      name: c.name,
      docs: c.docs ?? [],
      typeId: c.type,
    })),
    calls: extractCalls(meta, p.calls),
  }));
}

function extractCalls(meta: MetadataBundle, callsRef: { type: number } | undefined): CallInfo[] {
  if (!callsRef) return [];
  try {
    const entry = meta.lookup(callsRef.type);
    if (entry.type !== "enum") return [];
    return Object.entries(entry.value as Record<string, any>).map(([name, variant]) => ({
      name,
      docs: (variant as any).docs ?? [],
      typeId: resolveCallTypeId(variant),
    }));
  } catch {
    return [];
  }
}

function resolveCallTypeId(variant: any): number | null {
  if (variant.type === "lookupEntry") return variant.value?.id ?? null;
  if (variant.type === "struct") return null; // inline struct, no single typeId
  if (variant.type === "void" || variant.type === "empty") return null;
  return null;
}

export function findPallet(meta: MetadataBundle, palletName: string): PalletInfo | undefined {
  const pallets = listPallets(meta);
  return pallets.find((p) => p.name.toLowerCase() === palletName.toLowerCase());
}

export interface SignedExtensionInfo {
  identifier: string;
  type: number;
  additionalSigned: number;
}

export function getSignedExtensions(meta: MetadataBundle): SignedExtensionInfo[] {
  const byVersion = meta.unified.extrinsic.signedExtensions;
  // Use the first (and typically only) version key
  const versionKeys = Object.keys(byVersion);
  if (versionKeys.length === 0) return [];
  return byVersion[Number(versionKeys[0])] ?? [];
}

export function getPalletNames(meta: MetadataBundle): string[] {
  return meta.unified.pallets.map((p) => p.name);
}

export function describeType(lookup: Lookup, typeId: number): string {
  try {
    const entry = lookup(typeId);
    return formatLookupEntry(entry);
  } catch {
    return `type(${typeId})`;
  }
}

function formatLookupEntry(entry: any): string {
  switch (entry.type) {
    case "primitive":
      return entry.value;
    case "compact":
      return `Compact<${formatLookupEntry(entry.isBig ? { type: "primitive", value: "u128" } : { type: "primitive", value: "u64" })}>`;
    case "AccountId32":
      return "AccountId32";
    case "bitSequence":
      return "BitSequence";
    case "sequence":
      return `Vec<${formatLookupEntry(entry.value)}>`;
    case "array":
      return `[${formatLookupEntry(entry.value)}; ${entry.len}]`;
    case "tuple":
      return `(${entry.value.map(formatLookupEntry).join(", ")})`;
    case "struct":
      return `{ ${Object.entries(entry.value)
        .map(([k, v]) => `${k}: ${formatLookupEntry(v)}`)
        .join(", ")} }`;
    case "option":
      return `Option<${formatLookupEntry(entry.value)}>`;
    case "result":
      return `Result<${formatLookupEntry(entry.value.ok)}, ${formatLookupEntry(entry.value.ko)}>`;
    case "enum": {
      const variants = Object.keys(entry.value);
      if (variants.length <= 4) return variants.join(" | ");
      return `enum(${variants.length} variants)`;
    }
    default:
      return "unknown";
  }
}

export function describeCallArgs(
  meta: MetadataBundle,
  palletName: string,
  callName: string,
): string {
  try {
    const palletMeta = meta.unified.pallets.find((p) => p.name === palletName);
    if (!palletMeta?.calls) return "";

    const callsEntry = meta.lookup(palletMeta.calls.type);
    if (callsEntry.type !== "enum") return "";

    const variant = (callsEntry.value as Record<string, any>)[callName];
    if (!variant) return "";

    if (variant.type === "void") return "()";

    if (variant.type === "struct") {
      const fields = Object.entries(variant.value as Record<string, any>)
        .map(([k, v]) => `${k}: ${formatLookupEntry(v)}`)
        .join(", ");
      return `(${fields})`;
    }

    if (variant.type === "lookupEntry") {
      const inner = variant.value;
      if (inner.type === "void") return "()";
      if (inner.type === "struct") {
        const fields = Object.entries(inner.value as Record<string, any>)
          .map(([k, v]) => `${k}: ${formatLookupEntry(v)}`)
          .join(", ");
        return `(${fields})`;
      }
      return `(${formatLookupEntry(inner)})`;
    }

    if (variant.type === "tuple") {
      const types = (variant.value as any[]).map(formatLookupEntry).join(", ");
      return `(${types})`;
    }

    return "";
  } catch {
    return "";
  }
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return bytes;
}
