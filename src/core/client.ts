import { createClient } from "polkadot-api";
import { getWsProvider } from "polkadot-api/ws-provider";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import type { ChainConfig } from "../config/types.ts";
import { loadMetadata, saveMetadata } from "../config/store.ts";
import { ConnectionError } from "../utils/errors.ts";

// Known chain specs for light client usage
const KNOWN_CHAIN_SPECS: Record<string, string> = {
  polkadot: "polkadot-api/chains/polkadot",
  kusama: "polkadot-api/chains/ksmcc3",
  westend: "polkadot-api/chains/westend2",
  paseo: "polkadot-api/chains/paseo",
};

export interface ClientHandle {
  client: ReturnType<typeof createClient>;
  destroy: () => void;
}

export async function createChainClient(
  chainName: string,
  chainConfig: ChainConfig,
  rpcOverride?: string,
): Promise<ClientHandle> {
  const useLight = !rpcOverride && chainConfig.lightClient;

  let provider;

  if (useLight) {
    provider = await createSmoldotProvider(chainName);
  } else {
    const rpc = rpcOverride ?? chainConfig.rpc;
    if (!rpc) {
      throw new ConnectionError(
        `No RPC endpoint configured for chain "${chainName}". Use --rpc or configure one with: dot chain add ${chainName} --rpc <url>`,
      );
    }
    provider = withPolkadotSdkCompat(getWsProvider(rpc));
  }

  const client = createClient(provider, {
    getMetadata: async () => loadMetadata(chainName),
    setMetadata: async (_codeHash, metadata) => {
      await saveMetadata(chainName, metadata);
    },
  });

  return {
    client,
    destroy: () => client.destroy(),
  };
}

async function createSmoldotProvider(chainName: string) {
  const { start } = await import("polkadot-api/smoldot");
  const { getSmProvider } = await import("polkadot-api/sm-provider");

  const specPath = KNOWN_CHAIN_SPECS[chainName];
  if (!specPath) {
    throw new ConnectionError(
      `Light client is only supported for known chains: ${Object.keys(KNOWN_CHAIN_SPECS).join(", ")}. ` +
        `Use --rpc to connect to "${chainName}" instead.`,
    );
  }

  const { chainSpec } = await import(specPath);
  const smoldot = start();
  const chain = await smoldot.addChain({ chainSpec });
  return getSmProvider(chain);
}
