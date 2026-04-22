import { createClient } from "polkadot-api";
import { getWsProvider } from "polkadot-api/ws";
import { loadMetadata, saveMetadata } from "../config/store.ts";
import type { ChainConfig } from "../config/types.ts";
import { ConnectionError } from "../utils/errors.ts";

export interface ClientHandle {
  client: ReturnType<typeof createClient>;
  destroy: () => void;
}

export interface CreateChainClientDeps {
  createClient?: typeof createClient;
  getWsProvider?: typeof getWsProvider;
}

// Suppress noisy retry/teardown logs from polkadot-api internals.
// The WS provider logs "Unable to connect" via console.error, and the
// observable-client logs "ChainHead … request failed" via console.warn
// when the client is destroyed while subscriptions are still active.
function suppressProviderNoise(): () => void {
  const origError = console.error;
  const origWarn = console.warn;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes("Unable to connect")) return;
    origError(...args);
  };
  console.warn = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes("ChainHead")) return;
    origWarn(...args);
  };
  return () => {
    console.error = origError;
    console.warn = origWarn;
  };
}

export async function createChainClient(
  chainName: string,
  chainConfig: ChainConfig,
  rpcOverride?: string | string[],
  deps: CreateChainClientDeps = {},
): Promise<ClientHandle> {
  const _createClient = deps.createClient ?? createClient;
  const _getWsProvider = deps.getWsProvider ?? getWsProvider;
  const restoreConsole = suppressProviderNoise();

  const rpc = rpcOverride ?? chainConfig.rpc;
  if (!rpc) {
    restoreConsole();
    throw new ConnectionError(
      `No RPC endpoint configured for chain "${chainName}". Use --rpc or configure one with: dot chain add ${chainName} --rpc <url>`,
    );
  }
  const provider = _getWsProvider(rpc, { timeout: 10_000 });

  const client = _createClient(provider, {
    getMetadata: async () => loadMetadata(chainName),
    setMetadata: async (_codeHash, metadata) => {
      await saveMetadata(chainName, metadata);
    },
  });

  return {
    client,
    destroy: () => {
      try {
        client.destroy();
      } catch {
        // polkadot-api may throw DisjointError during chain head teardown
      }
      // Delay restore: polkadot-api fires async console.warn during teardown
      // (e.g. "ChainHead subfollow request failed") that must be suppressed.
      setTimeout(restoreConsole, 500);
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
