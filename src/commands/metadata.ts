import type { CAC } from "cac";
import {
  loadConfig,
  loadMetadata,
  loadMetadataFingerprint,
  resolveChain,
} from "../config/store.ts";
import { createChainClient } from "../core/client.ts";
import {
  fetchMetadataFromChain,
  getSignedExtensions,
  listPallets,
  listRuntimeApis,
  type MetadataBundle,
  parseMetadata,
} from "../core/metadata.ts";
import { formatJson } from "../core/output.ts";
import { CliError } from "../utils/errors.ts";
import type { RuntimeFingerprint } from "../utils/runtime-fingerprint.ts";

export interface MetadataPayload {
  chain: string;
  runtime: { metadataVersion: number } & Partial<RuntimeFingerprint>;
  pallets: ReturnType<typeof listPallets>;
  runtimeApis: ReturnType<typeof listRuntimeApis>;
  transactionExtensions: ReturnType<typeof getSignedExtensions>;
}

export function buildMetadataPayload(
  chainName: string,
  meta: MetadataBundle,
  fingerprint: RuntimeFingerprint | null,
): MetadataPayload {
  return {
    chain: chainName,
    runtime: { ...(fingerprint ?? {}), metadataVersion: meta.version },
    pallets: listPallets(meta),
    runtimeApis: listRuntimeApis(meta),
    transactionExtensions: getSignedExtensions(meta),
  };
}

export interface MetadataCommandOpts {
  raw?: boolean;
  cached?: boolean;
  rpc?: string | string[];
}

export async function handleMetadata(chain: string, opts: MetadataCommandOpts): Promise<void> {
  const config = await loadConfig();
  const { name: chainName, chain: chainConfig } = resolveChain(config, chain);

  let rawBytes: Uint8Array | null;
  if (opts.cached) {
    rawBytes = await loadMetadata(chainName);
    if (!rawBytes) {
      throw new CliError(
        `No cached metadata for "${chainName}". Run \`dot chain update ${chainName}\` first, or omit --cached to fetch fresh.`,
      );
    }
  } else {
    const clientHandle = await createChainClient(chainName, chainConfig, opts.rpc);
    try {
      // fetchMetadataFromChain also persists the runtime fingerprint sidecar
      // so subsequent commands can detect drift.
      await fetchMetadataFromChain(clientHandle, chainName);
    } finally {
      clientHandle.destroy();
    }
    rawBytes = await loadMetadata(chainName);
    if (!rawBytes) {
      throw new CliError(`Failed to load metadata for "${chainName}" after fetch.`);
    }
  }

  if (opts.raw) {
    console.log(`0x${Buffer.from(rawBytes).toString("hex")}`);
    return;
  }

  const meta = parseMetadata(rawBytes);
  const fingerprint = await loadMetadataFingerprint(chainName);
  console.log(formatJson(buildMetadataPayload(chainName, meta, fingerprint)));
}

export function registerMetadataCommand(cli: CAC) {
  cli
    .command("metadata <chain>", "Fetch chain metadata (decoded JSON; --raw for SCALE hex)")
    .option("--raw", "Print SCALE-encoded metadata bytes as hex instead of decoded JSON")
    .option("--cached", "Use cached metadata instead of fetching fresh from the chain")
    .option("--rpc <url>", "Override RPC endpoint(s)")
    .action((chain: string, opts: MetadataCommandOpts) => handleMetadata(chain, opts));
}
