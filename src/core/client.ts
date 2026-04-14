import { createClient } from "polkadot-api";
import { getWsProvider } from "polkadot-api/ws";
import { loadMetadata, saveMetadata } from "../config/store.ts";
import type { ChainConfig } from "../config/types.ts";
import { ConnectionError } from "../utils/errors.ts";

export interface ClientHandle {
  client: ReturnType<typeof createClient>;
  destroy: () => void;
}

// Suppress noisy "Unable to connect" retry logs from the WS provider.
// The WS provider uses console.error internally for connection failures.
function suppressWsNoise(): () => void {
  const orig = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes("Unable to connect")) return;
    orig(...args);
  };
  return () => {
    console.error = orig;
  };
}

export async function createChainClient(
  chainName: string,
  chainConfig: ChainConfig,
  rpcOverride?: string | string[],
): Promise<ClientHandle> {
  const restoreConsole = suppressWsNoise();

  const rpc = rpcOverride ?? chainConfig.rpc;
  if (!rpc) {
    restoreConsole();
    throw new ConnectionError(
      `No RPC endpoint configured for chain "${chainName}". Use --rpc or configure one with: dot chain add ${chainName} --rpc <url>`,
    );
  }
  const provider = getWsProvider(rpc, { timeout: 10_000 });

  const client = createClient(provider, {
    getMetadata: async () => loadMetadata(chainName),
    setMetadata: async (_codeHash, metadata) => {
      await saveMetadata(chainName, metadata);
    },
  });

  return {
    client,
    destroy: () => {
      client.destroy();
      restoreConsole();
    },
  };
}

export async function getParachainId(clientHandle: ClientHandle): Promise<number | null> {
  try {
    const unsafeApi = clientHandle.client.getUnsafeApi();
    const parachainId = await (unsafeApi as any).query.ParachainInfo.ParachainId.getValue();
    return typeof parachainId === "number" ? parachainId : null;
  } catch {
    return null;
  }
}
