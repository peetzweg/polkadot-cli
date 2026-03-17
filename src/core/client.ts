import type { JsonRpcProvider } from "@polkadot-api/json-rpc-provider";
import { createClient } from "polkadot-api";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { getWsProvider } from "polkadot-api/ws-provider";
import { WebSocket } from "ws";
import { loadMetadata, saveMetadata } from "../config/store.ts";
import type { ChainConfig } from "../config/types.ts";
import { ConnectionError } from "../utils/errors.ts";

// Known chain specs for light client usage
interface ChainSpecEntry {
  spec: string;
  relay?: string;
  explorerRpc: string; // representative RPC for explorer links when using light client
}

const KNOWN_CHAIN_SPECS: Record<string, ChainSpecEntry> = {
  polkadot: { spec: "polkadot-api/chains/polkadot", explorerRpc: "wss://rpc.polkadot.io" },
  kusama: { spec: "polkadot-api/chains/ksmcc3", explorerRpc: "wss://kusama-rpc.polkadot.io" },
  westend: { spec: "polkadot-api/chains/westend2", explorerRpc: "wss://westend-rpc.polkadot.io" },
  paseo: { spec: "polkadot-api/chains/paseo", explorerRpc: "wss://paseo.ibp.network" },
  "polkadot-asset-hub": { spec: "polkadot-api/chains/polkadot_asset_hub", relay: "polkadot", explorerRpc: "wss://polkadot-asset-hub-rpc.polkadot.io" },
  "polkadot-bridge-hub": { spec: "polkadot-api/chains/polkadot_bridge_hub", relay: "polkadot", explorerRpc: "wss://polkadot-bridge-hub-rpc.polkadot.io" },
  "polkadot-collectives": { spec: "polkadot-api/chains/polkadot_collectives", relay: "polkadot", explorerRpc: "wss://polkadot-collectives-rpc.polkadot.io" },
  "polkadot-coretime": { spec: "polkadot-api/chains/polkadot_coretime", relay: "polkadot", explorerRpc: "wss://polkadot-coretime-rpc.polkadot.io" },
  "polkadot-people": { spec: "polkadot-api/chains/polkadot_people", relay: "polkadot", explorerRpc: "wss://polkadot-people-rpc.polkadot.io" },
  "paseo-asset-hub": { spec: "polkadot-api/chains/paseo_asset_hub", relay: "paseo", explorerRpc: "wss://asset-hub-paseo.ibp.network" },
  "paseo-coretime": { spec: "polkadot-api/chains/paseo_coretime", relay: "paseo", explorerRpc: "wss://coretime-paseo.ibp.network" },
  "paseo-people": { spec: "polkadot-api/chains/paseo_people", relay: "paseo", explorerRpc: "wss://people-paseo.ibp.network" },
};

/** Check whether a chain has a built-in light client spec. */
export function hasLightClientSpec(chainName: string): boolean {
  return chainName in KNOWN_CHAIN_SPECS;
}

/** Return the representative explorer RPC for a known chain, or undefined. */
export function getExplorerRpc(chainName: string): string | undefined {
  return KNOWN_CHAIN_SPECS[chainName]?.explorerRpc;
}

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
  const configRpc = chainConfig.rpc;
  const hasConfigRpc = configRpc && (!Array.isArray(configRpc) || configRpc.length > 0) && configRpc !== "";
  const useLight = !rpcOverride && !hasConfigRpc && chainName in KNOWN_CHAIN_SPECS;

  const restoreConsole = suppressWsNoise();

  let provider: JsonRpcProvider;

  if (useLight) {
    provider = await createSmoldotProvider(chainName);
  } else {
    const rpc = rpcOverride ?? chainConfig.rpc;
    const hasRpc = rpc && (!Array.isArray(rpc) || rpc.length > 0);
    if (!hasRpc) {
      restoreConsole();
      throw new ConnectionError(
        `No RPC endpoint configured for chain "${chainName}". Use --rpc or configure one with: dot chain add ${chainName} --rpc <url>`,
      );
    }
    provider = withPolkadotSdkCompat(
      getWsProvider(rpc, {
        timeout: 10_000,
        websocketClass: WebSocket as unknown as typeof globalThis.WebSocket,
      }),
    );
  }

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

async function createSmoldotProvider(chainName: string) {
  const { start } = await import("polkadot-api/smoldot");
  const { getSmProvider } = await import("polkadot-api/sm-provider");

  const entry = KNOWN_CHAIN_SPECS[chainName];
  if (!entry) {
    throw new ConnectionError(
      `Light client is only supported for known chains: ${Object.keys(KNOWN_CHAIN_SPECS).join(", ")}. ` +
        `Use --rpc to connect to "${chainName}" instead.`,
    );
  }

  const { chainSpec } = await import(entry.spec);
  const smoldot = start();

  if (entry.relay) {
    const relayEntry = KNOWN_CHAIN_SPECS[entry.relay];
    if (!relayEntry) {
      throw new ConnectionError(`Relay chain "${entry.relay}" not found in known chain specs.`);
    }
    const { chainSpec: relaySpec } = await import(relayEntry.spec);
    const relayChain = await smoldot.addChain({ chainSpec: relaySpec, disableJsonRpc: true });
    const chain = await smoldot.addChain({ chainSpec, potentialRelayChains: [relayChain] });
    return getSmProvider(chain);
  }

  const chain = await smoldot.addChain({ chainSpec });
  return getSmProvider(chain);
}
