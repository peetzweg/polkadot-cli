import { getDynamicBuilder, getLookupFn } from "@polkadot-api/metadata-builders";
import {
  Bytes,
  decAnyMetadata,
  Option,
  u32,
  unifyMetadata,
} from "@polkadot-api/substrate-bindings";
import { toHex } from "@polkadot-api/utils";
import { loadMetadata, loadMetadataFingerprint, saveMetadata } from "../config/store.ts";
import {
  CliError,
  ConnectionError,
  formatRuntimeError,
  isBlockUnavailableError,
  isLikelyStaleMetadataError,
  MetadataError,
} from "../utils/errors.ts";
import { fingerprintsMatch, type RuntimeFingerprint } from "../utils/runtime-fingerprint.ts";
import type { ClientHandle } from "./client.ts";
import {
  _getCallFields,
  _getEventFields,
  compactArgsString,
  compactTypeString,
} from "./pretty-type.ts";

const METADATA_TIMEOUT_MS = 15_000;
const optionalOpaqueBytes = Option(Bytes());
const v15Arg = toHex(u32.enc(15));

export interface PalletInfo {
  name: string;
  index: number;
  docs: string[];
  storage: StorageItemInfo[];
  constants: ConstantInfo[];
  calls: CallInfo[];
  events: EventInfo[];
  errors: ErrorInfo[];
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

export interface EventInfo {
  name: string;
  docs: string[];
  typeId: number | null;
}

export interface ErrorInfo {
  name: string;
  docs: string[];
}

export type UnifiedMeta = ReturnType<typeof unifyMetadata>;
export type Lookup = ReturnType<typeof getLookupFn>;
export type DynamicBuilder = ReturnType<typeof getDynamicBuilder>;

export interface MetadataBundle {
  unified: UnifiedMeta;
  lookup: Lookup;
  builder: DynamicBuilder;
  version: number;
}

export function parseMetadata(raw: Uint8Array): MetadataBundle {
  const decoded = decAnyMetadata(raw);
  const version = Number(decoded.metadata.tag.replace("v", ""));
  const unified = unifyMetadata(decoded);
  const lookup = getLookupFn(unified);
  const builder = getDynamicBuilder(lookup);
  return { unified, lookup, builder, version };
}

interface RuntimeVersionRpc {
  specName: string;
  specVersion: number;
  transactionVersion: number;
  implName: string;
  implVersion: number;
  authoringVersion: number;
}

export async function getRuntimeFingerprint(
  clientHandle: ClientHandle,
  chainName: string,
): Promise<RuntimeFingerprint> {
  const { client } = clientHandle;
  const [version, codeHash] = await Promise.all([
    withTimeout(client._request<RuntimeVersionRpc>("state_getRuntimeVersion", []), chainName),
    withTimeout(client._request<string>("state_getStorageHash", ["0x3a636f6465"]), chainName),
  ]);
  return {
    specName: version.specName,
    specVersion: version.specVersion,
    transactionVersion: version.transactionVersion,
    implName: version.implName,
    implVersion: version.implVersion,
    authoringVersion: version.authoringVersion,
    codeHash,
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchMetadataFromChain(
  clientHandle: ClientHandle,
  chainName: string,
): Promise<Uint8Array> {
  const { client } = clientHandle;

  let bytes: Uint8Array | undefined;

  // Try v15 metadata first (includes runtime API info)
  try {
    const hex = await withTimeout(
      client._request<string>("state_call", ["Metadata_metadata_at_version", v15Arg]),
      chainName,
    );
    const raw = hexToBytes(hex);
    const decoded = optionalOpaqueBytes.dec(raw);
    if (decoded !== undefined) {
      bytes = new Uint8Array(decoded);
    }
  } catch {
    // v15 not available, fall through to v14
  }

  if (!bytes) {
    // Fall back to state_getMetadata (v14)
    try {
      const hex = await withTimeout(client._request<string>("state_getMetadata", []), chainName);
      bytes = hexToBytes(hex);
    } catch (err) {
      if (err instanceof ConnectionError) throw err;
      throw new ConnectionError(
        `Failed to fetch metadata for "${chainName}": ${err instanceof Error ? err.message : err}. ` +
          "Check that the RPC endpoint is correct and reachable.",
      );
    }
  }

  // Best-effort: alongside the metadata, persist a runtime fingerprint so we
  // can detect stale local metadata after a future failure. Don't fail the
  // metadata fetch if the fingerprint RPCs are unavailable on this endpoint.
  let fingerprint: RuntimeFingerprint | undefined;
  try {
    fingerprint = await getRuntimeFingerprint(clientHandle, chainName);
  } catch {
    fingerprint = undefined;
  }
  await saveMetadata(chainName, bytes, fingerprint);
  return bytes;
}

function withTimeout<T>(promise: Promise<T>, chainName: string): Promise<T> {
  return Promise.race([
    promise,
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
}

// Run `task` and, if it fails with an error that smells like stale metadata,
// verify by comparing the cached runtime fingerprint against the live chain.
// If they differ, re-throw with a CliError that wraps the original error and
// suggests `dot chain update <chain>`. Never refreshes metadata automatically.
export async function withStalenessSuggestion<T>(
  chainName: string,
  clientHandle: ClientHandle,
  task: () => Promise<T>,
): Promise<T> {
  try {
    return await task();
  } catch (err) {
    if (process.env.DOT_TRUST_CACHED_METADATA === "1") throw err;
    if (!isLikelyStaleMetadataError(err)) throw err;

    let live: RuntimeFingerprint;
    try {
      live = await getRuntimeFingerprint(clientHandle, chainName);
    } catch {
      throw err;
    }
    const cached = await loadMetadataFingerprint(chainName);
    if (!cached) throw err;
    if (fingerprintsMatch(cached, live)) throw err;

    const original = err instanceof Error ? formatRuntimeError(err) : String(err);
    const versionNote =
      cached.specVersion !== live.specVersion
        ? `spec ${cached.specVersion} → ${live.specVersion}`
        : `runtime code hash changed (same spec ${live.specVersion}; likely a node restart with new wasm)`;
    throw new CliError(
      `${original}\n\n` +
        `⚠ Local metadata for "${chainName}" is out of date (${versionNote}).\n` +
        `   Run: dot chain update ${chainName}`,
    );
  }
}

// Catch papi errors raised when --at <hash> points at a block the RPC can't
// serve and re-throw as a CliError that tells the user to use an archive node.
// Pure error-shape detection — no extra RPC roundtrip, so this composes cheaply
// inside the staleness wrapper at call sites.
export async function withBlockAvailabilityHint<T>(
  atRaw: string | undefined,
  task: () => Promise<T>,
): Promise<T> {
  try {
    return await task();
  } catch (err) {
    if (!isBlockUnavailableError(err)) throw err;
    const original = err instanceof Error ? err.message : String(err);
    const isExplicitHash = atRaw && atRaw !== "best" && atRaw !== "finalized";
    const target = isExplicitHash ? atRaw : "the requested block";
    const exampleAt = isExplicitHash ? atRaw : "<hash>";
    throw new CliError(
      `${original}\n\n` +
        `⚠ ${target} is not available on the current RPC endpoint.\n` +
        `   Public nodes serve only recent (pinned) blocks via chainHead_v1_*.\n` +
        `   For deep historical reads, point --rpc at an archive endpoint, e.g.:\n` +
        `     dot ... --at ${exampleAt} --rpc wss://<archive-endpoint>`,
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
  const sortByName = <T extends { name: string }>(arr: T[]) =>
    arr.sort((a, b) => a.name.localeCompare(b.name));

  return sortByName(
    meta.unified.pallets.map((p) => ({
      name: p.name,
      index: p.index,
      docs: p.docs ?? [],
      storage: sortByName(
        (p.storage?.items ?? []).map((s) => ({
          name: s.name,
          docs: s.docs ?? [],
          type: s.type.tag,
          keyTypeId: s.type.tag === "map" ? s.type.value.key : null,
          valueTypeId: s.type.tag === "plain" ? s.type.value : s.type.value.value,
        })),
      ),
      constants: sortByName(
        (p.constants ?? []).map((c) => ({
          name: c.name,
          docs: c.docs ?? [],
          typeId: c.type,
        })),
      ),
      calls: sortByName(extractEnumVariants(meta, p.calls)),
      events: sortByName(extractEnumVariants(meta, p.events)),
      errors: sortByName(
        extractEnumVariants(meta, p.errors).map(({ name, docs }) => ({ name, docs })),
      ),
    })),
  );
}

function extractEnumVariants(meta: MetadataBundle, ref: { type: number } | undefined): CallInfo[] {
  if (!ref) return [];
  try {
    const entry = meta.lookup(ref.type);
    if (entry.type !== "enum") return [];
    return Object.entries(entry.value as Record<string, any>).map(([name, variant]) => ({
      name,
      docs: (entry as any).innerDocs?.[name] ?? [],
      typeId: resolveVariantTypeId(variant),
    }));
  } catch {
    return [];
  }
}

function resolveVariantTypeId(variant: any): number | null {
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

/** Signed extensions that polkadot-api fills in automatically when building a tx. */
export const PAPI_BUILTIN_EXTENSIONS: ReadonlySet<string> = new Set([
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

export function getSignedExtensions(meta: MetadataBundle): SignedExtensionInfo[] {
  const byVersion = meta.unified.extrinsic.signedExtensions;
  // Use the first (and typically only) version key
  const versionKeys = Object.keys(byVersion);
  if (versionKeys.length === 0) return [];
  return byVersion[Number(versionKeys[0])] ?? [];
}

export function getSignedExtensionNames(meta: MetadataBundle): string[] {
  return getSignedExtensions(meta)
    .map((e) => e.identifier)
    .sort((a, b) => a.localeCompare(b));
}

export function findSignedExtension(
  meta: MetadataBundle,
  identifier: string,
): SignedExtensionInfo | undefined {
  return getSignedExtensions(meta).find(
    (e) => e.identifier.toLowerCase() === identifier.toLowerCase(),
  );
}

export interface SignedExtensionDescription {
  identifier: string;
  valueType: string;
  additionalSignedType: string;
  valueTypeId: number;
  additionalSignedTypeId: number;
  isBuiltin: boolean;
}

export function describeSignedExtension(
  meta: MetadataBundle,
  info: SignedExtensionInfo,
): SignedExtensionDescription {
  return {
    identifier: info.identifier,
    valueType: describeType(meta.lookup, info.type),
    additionalSignedType: describeType(meta.lookup, info.additionalSigned),
    valueTypeId: info.type,
    additionalSignedTypeId: info.additionalSigned,
    isBuiltin: PAPI_BUILTIN_EXTENSIONS.has(info.identifier),
  };
}

export function getPalletNames(meta: MetadataBundle): string[] {
  return meta.unified.pallets.map((p) => p.name).sort((a, b) => a.localeCompare(b));
}

export interface RuntimeApiInfo {
  name: string;
  methods: RuntimeApiMethodInfo[];
  docs: string[];
}

export interface RuntimeApiMethodInfo {
  name: string;
  inputs: Array<{ name: string; type: number }>;
  output: number;
  docs: string[];
}

export function listRuntimeApis(meta: MetadataBundle): RuntimeApiInfo[] {
  const sortByName = <T extends { name: string }>(arr: T[]) =>
    arr.sort((a, b) => a.name.localeCompare(b.name));

  return sortByName(
    meta.unified.apis.map((api) => ({
      name: api.name,
      docs: api.docs ?? [],
      methods: sortByName(
        api.methods.map((m) => ({
          name: m.name,
          inputs: m.inputs.map((i) => ({ name: i.name, type: i.type })),
          output: m.output,
          docs: m.docs ?? [],
        })),
      ),
    })),
  );
}

export function findRuntimeApi(meta: MetadataBundle, apiName: string): RuntimeApiInfo | undefined {
  return listRuntimeApis(meta).find((a) => a.name.toLowerCase() === apiName.toLowerCase());
}

export function getRuntimeApiNames(meta: MetadataBundle): string[] {
  return meta.unified.apis.map((a) => a.name).sort((a, b) => a.localeCompare(b));
}

export function describeRuntimeApiMethodArgs(
  meta: MetadataBundle,
  method: RuntimeApiMethodInfo,
): string {
  if (method.inputs.length === 0) return "()";
  const fields = method.inputs
    .map((i) => `${i.name}: ${describeType(meta.lookup, i.type)}`)
    .join(", ");
  return `(${fields})`;
}

export function describeType(lookup: Lookup, typeId: number): string {
  try {
    const entry = lookup(typeId);
    if (!entry || typeof (entry as any).type !== "string") return `type(${typeId})`;
    return compactTypeString(entry);
  } catch {
    return `type(${typeId})`;
  }
}

export function describeCallArgs(
  meta: MetadataBundle,
  palletName: string,
  callName: string,
): string {
  return compactArgsString(_getCallFields(meta, palletName, callName));
}

export function describeEventFields(
  meta: MetadataBundle,
  palletName: string,
  eventName: string,
): string {
  return compactArgsString(_getEventFields(meta, palletName, eventName));
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return bytes;
}
