import type { JsonRpcProvider } from "@polkadot-api/json-rpc-provider";
import { createClient } from "polkadot-api";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { getWsProvider } from "polkadot-api/ws-provider";
import { WebSocket } from "ws";
import { loadMetadata, saveMetadata } from "../config/store.ts";
import type { ChainConfig } from "../config/types.ts";
import { ConnectionError } from "../utils/errors.ts";

export interface ClientHandle {
  client: ReturnType<typeof createClient>;
  destroy: () => void;
}

// Suppress noisy "Unable to connect" retry logs from the WS provider.
// The ws-provider uses console.error internally for connection failures.
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
  const provider: JsonRpcProvider = withPolkadotSdkCompat(
    getWsProvider(rpc, {
      timeout: 10_000,
      websocketClass: WebSocket as unknown as typeof globalThis.WebSocket,
    }),
  );

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

