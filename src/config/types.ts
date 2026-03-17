export interface ChainConfig {
  rpc: string | string[];
  /** @deprecated Light client is auto-detected from KNOWN_CHAIN_SPECS. This field is ignored. */
  lightClient?: boolean;
}

export interface Config {
  defaultChain: string;
  chains: Record<string, ChainConfig>;
}

/** Return the first (primary) RPC endpoint. */
export function primaryRpc(rpc: string | string[]): string {
  return Array.isArray(rpc) ? rpc[0]! : rpc;
}

export const DEFAULT_CONFIG: Config = {
  defaultChain: "polkadot",
  chains: {
    // Chains with light client specs use empty RPCs → light client by default
    polkadot: { rpc: [] },
    "polkadot-asset-hub": { rpc: [] },
    "polkadot-bridge-hub": { rpc: [] },
    "polkadot-collectives": { rpc: [] },
    "polkadot-coretime": { rpc: [] },
    "polkadot-people": { rpc: [] },
    paseo: { rpc: [] },
    "paseo-asset-hub": { rpc: [] },
    "paseo-coretime": { rpc: [] },
    "paseo-people": { rpc: [] },
    // Chains without light client specs keep explicit RPCs
    "paseo-bridge-hub": {
      rpc: ["wss://bridge-hub-paseo.ibp.network", "wss://bridge-hub-paseo.dotters.network"],
    },
    "paseo-collectives": {
      rpc: ["wss://collectives-paseo.ibp.network", "wss://collectives-paseo.dotters.network"],
    },
  },
};

export const BUILTIN_CHAIN_NAMES = new Set(Object.keys(DEFAULT_CONFIG.chains));
