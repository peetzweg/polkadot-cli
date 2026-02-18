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
    polkadot: {
      rpc: "wss://rpc.polkadot.io",
    },
  },
};
