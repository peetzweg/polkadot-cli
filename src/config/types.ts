export interface ChainConfig {
  rpc: string;
  lightClient?: boolean;
}

export interface Config {
  defaultChain: string;
  chains: Record<string, ChainConfig>;
}

export const DEFAULT_CONFIG: Config = {
  defaultChain: "polkadot",
  chains: {
    polkadot: { rpc: "wss://rpc.polkadot.io" },
    paseo: { rpc: "wss://rpc.ibp.network/paseo" },
    "polkadot-asset-hub": { rpc: "wss://polkadot-asset-hub-rpc.polkadot.io" },
    "paseo-asset-hub": { rpc: "wss://asset-hub-paseo-rpc.dwellir.com" },
    "polkadot-people": { rpc: "wss://polkadot-people-rpc.polkadot.io" },
  },
};

export const BUILTIN_CHAIN_NAMES = new Set(Object.keys(DEFAULT_CONFIG.chains));
