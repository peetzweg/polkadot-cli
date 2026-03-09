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
        "wss://polkadot.ibp.network",
        "wss://polkadot.dotters.network",
        "wss://polkadot-rpc.n.dwellir.com",
        "wss://polkadot-rpc.publicnode.com",
        "wss://rpc-polkadot.luckyfriday.io",
        "wss://polkadot.api.onfinality.io/public-ws",
        "wss://rpc-polkadot.helixstreet.io",
        "wss://polkadot-rpc-tn.dwellir.com",
        "wss://polkadot.public.curie.radiumblock.co/ws",
        "wss://rpc-polkadot.stakeworld.io",
        "wss://polkadot.rpc.subquery.network/public/ws",
        "wss://rpc.polkadot.io",
      ],
    },
    "polkadot-asset-hub": {
      rpc: [
        "wss://polkadot-asset-hub-rpc.polkadot.io",
        "wss://asset-hub-polkadot.ibp.network",
        "wss://asset-hub-polkadot.dotters.network",
        "wss://asset-hub-polkadot-rpc.n.dwellir.com",
        "wss://rpc-asset-hub-polkadot.luckyfriday.io",
        "wss://statemint.api.onfinality.io/public-ws",
        "wss://statemint-rpc-tn.dwellir.com",
        "wss://statemint.public.curie.radiumblock.co/ws",
        "wss://asset-hub-polkadot.rpc.permanence.io",
      ],
    },
    "polkadot-bridge-hub": {
      rpc: [
        "wss://polkadot-bridge-hub-rpc.polkadot.io",
        "wss://bridge-hub-polkadot.ibp.network",
        "wss://bridge-hub-polkadot.dotters.network",
        "wss://bridge-hub-polkadot-rpc.n.dwellir.com",
        "wss://rpc-bridge-hub-polkadot.luckyfriday.io",
        "wss://bridgehub-polkadot.api.onfinality.io/public-ws",
        "wss://polkadot-bridge-hub-rpc-tn.dwellir.com",
        "wss://bridgehub-polkadot.public.curie.radiumblock.co/ws",
      ],
    },
    "polkadot-collectives": {
      rpc: [
        "wss://polkadot-collectives-rpc.polkadot.io",
        "wss://collectives-polkadot.ibp.network",
        "wss://collectives-polkadot.dotters.network",
        "wss://collectives-polkadot-rpc.n.dwellir.com",
        "wss://rpc-collectives-polkadot.luckyfriday.io",
        "wss://collectives.api.onfinality.io/public-ws",
        "wss://polkadot-collectives-rpc-tn.dwellir.com",
        "wss://collectives.public.curie.radiumblock.co/ws",
      ],
    },
    "polkadot-coretime": {
      rpc: [
        "wss://polkadot-coretime-rpc.polkadot.io",
        "wss://coretime-polkadot.ibp.network",
        "wss://coretime-polkadot.dotters.network",
        "wss://coretime-polkadot-rpc.n.dwellir.com",
        "wss://rpc-coretime-polkadot.luckyfriday.io",
        "wss://coretime-polkadot.api.onfinality.io/public-ws",
      ],
    },
    "polkadot-people": {
      rpc: [
        "wss://polkadot-people-rpc.polkadot.io",
        "wss://people-polkadot.ibp.network",
        "wss://people-polkadot.dotters.network",
        "wss://people-polkadot-rpc.n.dwellir.com",
        "wss://rpc-people-polkadot.luckyfriday.io",
        "wss://people-polkadot.api.onfinality.io/public-ws",
      ],
    },
    paseo: {
      rpc: [
        "wss://paseo.ibp.network",
        "wss://paseo.dotters.network",
        "wss://paseo-rpc.n.dwellir.com",
        "wss://paseo.rpc.amforc.com",
      ],
    },
    "paseo-asset-hub": {
      rpc: [
        "wss://asset-hub-paseo.ibp.network",
        "wss://asset-hub-paseo.dotters.network",
        "wss://asset-hub-paseo-rpc.n.dwellir.com",
        "wss://sys.turboflakes.io/asset-hub-paseo",
      ],
    },
    "paseo-bridge-hub": {
      rpc: ["wss://bridge-hub-paseo.ibp.network", "wss://bridge-hub-paseo.dotters.network"],
    },
    "paseo-collectives": {
      rpc: ["wss://collectives-paseo.ibp.network", "wss://collectives-paseo.dotters.network"],
    },
    "paseo-coretime": {
      rpc: ["wss://coretime-paseo.ibp.network", "wss://coretime-paseo.dotters.network"],
    },
    "paseo-people": {
      rpc: [
        "wss://people-paseo.ibp.network",
        "wss://people-paseo.dotters.network",
        "wss://people-paseo.rpc.amforc.com",
      ],
    },
  },
};

export const BUILTIN_CHAIN_NAMES = new Set(Object.keys(DEFAULT_CONFIG.chains));
