export interface ChainConfig {
  rpc: string | string[];
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
    polkadot: {
      rpc: [
        "wss://rpc.polkadot.io",
        "wss://polkadot-rpc.dwellir.com",
        "wss://rpc.ibp.network/polkadot",
      ],
    },
    paseo: {
      rpc: ["wss://rpc.ibp.network/paseo", "wss://paseo-rpc.dwellir.com"],
    },
    "polkadot-asset-hub": {
      rpc: ["wss://polkadot-asset-hub-rpc.polkadot.io", "wss://asset-hub-polkadot-rpc.dwellir.com"],
    },
    "paseo-asset-hub": {
      rpc: ["wss://asset-hub-paseo-rpc.dwellir.com"],
    },
    "polkadot-people": {
      rpc: ["wss://polkadot-people-rpc.polkadot.io", "wss://people-polkadot-rpc.dwellir.com"],
    },
  },
};

export const BUILTIN_CHAIN_NAMES = new Set(Object.keys(DEFAULT_CONFIG.chains));
