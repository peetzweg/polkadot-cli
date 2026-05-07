/**
 * Hand-curated metadata for well-known JSON-RPC methods. Used to render
 * `--help`, group `--list` output, and tag dangerous calls. Methods not in
 * this registry still work — they fall back to raw passthrough.
 *
 * The full set of methods a node exposes is discovered at runtime via
 * `rpc_methods` and cached per chain.
 */

export type RpcFamily =
  | "system"
  | "chain"
  | "state"
  | "author"
  | "payment"
  | "babe"
  | "grandpa"
  | "beefy"
  | "mmr"
  | "offchain"
  | "dev"
  | "spec"
  | "chainHead"
  | "chainSpec"
  | "transaction"
  | "archive"
  | "other";

export interface RpcArg {
  name: string;
  type: string;
  optional?: boolean;
  description?: string;
}

export interface RpcMethodInfo {
  description: string;
  family: RpcFamily;
  args: RpcArg[];
  /** Mutates node/keystore/chain state. Tagged WRITE in --help. */
  dangerous?: boolean;
  /** Subscription method — not callable as a one-shot. */
  subscription?: boolean;
}

export const RPC_REGISTRY: Record<string, RpcMethodInfo> = {
  // ---------------- system ----------------
  system_health: {
    description: "Node sync state (peers, isSyncing, shouldHavePeers).",
    family: "system",
    args: [],
  },
  system_syncState: {
    description: "Block-level sync progress (startingBlock, currentBlock, highestBlock).",
    family: "system",
    args: [],
  },
  system_version: {
    description: "Node software version string.",
    family: "system",
    args: [],
  },
  system_name: {
    description: "Node implementation name.",
    family: "system",
    args: [],
  },
  system_chain: {
    description: "Chain name as reported by the node.",
    family: "system",
    args: [],
  },
  system_chainType: {
    description: "Chain type (Live, Development, Local).",
    family: "system",
    args: [],
  },
  system_properties: {
    description: "Chain properties (ss58Format, tokenDecimals, tokenSymbol).",
    family: "system",
    args: [],
  },
  system_peers: {
    description: "Connected peer details (peerId, roles, bestHash, bestNumber).",
    family: "system",
    args: [],
  },
  system_localPeerId: {
    description: "Base58 PeerId of this node.",
    family: "system",
    args: [],
  },
  system_localListenAddresses: {
    description: "Multiaddrs this node listens on.",
    family: "system",
    args: [],
  },
  system_nodeRoles: {
    description: "Role(s) of the node (Authority, Full, Light, …).",
    family: "system",
    args: [],
  },
  system_addLogFilter: {
    description: "Add a tracing/log filter directive at runtime.",
    family: "system",
    args: [{ name: "directives", type: "string" }],
    dangerous: true,
  },
  system_resetLogFilter: {
    description: "Reset log filter to the default set at startup.",
    family: "system",
    args: [],
    dangerous: true,
  },
  system_accountNextIndex: {
    description: "Next nonce for an account, including pending mempool extrinsics.",
    family: "system",
    args: [{ name: "address", type: "AccountId" }],
  },
  system_dryRun: {
    description: "Dry-run an extrinsic, returning its ApplyExtrinsicResult.",
    family: "system",
    args: [
      { name: "extrinsic", type: "hex" },
      { name: "at", type: "H256", optional: true },
    ],
  },

  // ---------------- chain ----------------
  chain_getBlock: {
    description: "Full block (header + extrinsics) by hash.",
    family: "chain",
    args: [{ name: "blockHash", type: "H256", optional: true, description: "latest if omitted" }],
  },
  chain_getBlockHash: {
    description: "Block hash by number, or latest if omitted.",
    family: "chain",
    args: [{ name: "blockNumber", type: "u32", optional: true }],
  },
  chain_getFinalizedHead: {
    description: "Hash of the latest finalized head.",
    family: "chain",
    args: [],
  },
  chain_getHeader: {
    description: "Block header by hash, or latest if omitted.",
    family: "chain",
    args: [{ name: "blockHash", type: "H256", optional: true }],
  },
  chain_subscribeAllHeads: {
    description: "Subscribe to all imported headers.",
    family: "chain",
    args: [],
    subscription: true,
  },
  chain_subscribeFinalizedHeads: {
    description: "Subscribe to finalized-head changes.",
    family: "chain",
    args: [],
    subscription: true,
  },
  chain_subscribeNewHeads: {
    description: "Subscribe to best-block-head changes.",
    family: "chain",
    args: [],
    subscription: true,
  },

  // ---------------- state ----------------
  state_call: {
    description: "Invoke a runtime API method by name with raw SCALE-encoded arguments.",
    family: "state",
    args: [
      { name: "method", type: "string", description: "e.g. Core_version" },
      { name: "data", type: "hex", description: "SCALE-encoded args (0x for none)" },
      { name: "at", type: "H256", optional: true },
    ],
  },
  state_getMetadata: {
    description: "Raw SCALE-encoded runtime metadata at a block.",
    family: "state",
    args: [{ name: "at", type: "H256", optional: true }],
  },
  state_getRuntimeVersion: {
    description: "Runtime version at a block.",
    family: "state",
    args: [{ name: "at", type: "H256", optional: true }],
  },
  state_getStorage: {
    description: "Raw SCALE-encoded storage value at a key.",
    family: "state",
    args: [
      { name: "key", type: "StorageKey" },
      { name: "at", type: "H256", optional: true },
    ],
  },
  state_getStorageHash: {
    description: "Blake2 hash of the value at a storage key.",
    family: "state",
    args: [
      { name: "key", type: "StorageKey" },
      { name: "at", type: "H256", optional: true },
    ],
  },
  state_getStorageSize: {
    description: "Byte length of the value at a storage key.",
    family: "state",
    args: [
      { name: "key", type: "StorageKey" },
      { name: "at", type: "H256", optional: true },
    ],
  },
  state_getKeysPaged: {
    description: "Paginated key iteration under a prefix.",
    family: "state",
    args: [
      { name: "prefix", type: "StorageKey" },
      { name: "count", type: "u32" },
      { name: "startKey", type: "StorageKey", optional: true },
      { name: "at", type: "H256", optional: true },
    ],
  },
  state_queryStorageAt: {
    description: "Read multiple keys at a single block.",
    family: "state",
    args: [
      { name: "keys", type: "StorageKey[]" },
      { name: "at", type: "H256", optional: true },
    ],
  },
  state_traceBlock: {
    description: "Per-block storage access trace (heavy: archival/debug nodes only).",
    family: "state",
    args: [
      { name: "blockHash", type: "H256" },
      { name: "targets", type: "string", optional: true },
      { name: "storageKeys", type: "string", optional: true },
      { name: "methods", type: "string", optional: true },
    ],
  },
  state_subscribeRuntimeVersion: {
    description: "Subscribe to runtime upgrades.",
    family: "state",
    args: [],
    subscription: true,
  },
  state_subscribeStorage: {
    description: "Subscribe to changes for a set of keys.",
    family: "state",
    args: [{ name: "keys", type: "StorageKey[]" }],
    subscription: true,
  },

  // ---------------- author ----------------
  author_pendingExtrinsics: {
    description: "Mempool snapshot — encoded extrinsics waiting to be included.",
    family: "author",
    args: [],
  },
  author_submitExtrinsic: {
    description: "Submit a signed extrinsic to the mempool. Returns the tx hash.",
    family: "author",
    args: [{ name: "extrinsic", type: "hex" }],
    dangerous: true,
  },
  author_removeExtrinsic: {
    description: "Remove specific extrinsics from the mempool by hash.",
    family: "author",
    args: [{ name: "bytesOrHash", type: "ExtrinsicOrHash[]" }],
    dangerous: true,
  },
  author_hasKey: {
    description: "Whether the keystore has the public key for a given key type.",
    family: "author",
    args: [
      { name: "publicKey", type: "hex" },
      { name: "keyType", type: "string", description: "e.g. babe, gran, imon" },
    ],
  },
  author_hasSessionKeys: {
    description: "Whether the keystore has all keys for a session-keys blob.",
    family: "author",
    args: [{ name: "sessionKeys", type: "hex" }],
  },
  author_rotateKeys: {
    description: "Generate a new set of session keys and return the public-keys blob.",
    family: "author",
    args: [],
    dangerous: true,
  },
  author_insertKey: {
    description: "Insert a key into the node keystore.",
    family: "author",
    args: [
      { name: "keyType", type: "string" },
      { name: "suri", type: "string" },
      { name: "publicKey", type: "hex" },
    ],
    dangerous: true,
  },
  author_submitAndWatchExtrinsic: {
    description: "Submit an extrinsic and subscribe to its status updates.",
    family: "author",
    args: [{ name: "extrinsic", type: "hex" }],
    dangerous: true,
    subscription: true,
  },

  // ---------------- payment ----------------
  payment_queryInfo: {
    description: "Pre-submission fee estimate (weight, partialFee, class).",
    family: "payment",
    args: [
      { name: "extrinsic", type: "hex" },
      { name: "at", type: "H256", optional: true },
    ],
  },
  payment_queryFeeDetails: {
    description: "Fee breakdown (baseFee, lenFee, adjustedWeightFee, tip).",
    family: "payment",
    args: [
      { name: "extrinsic", type: "hex" },
      { name: "at", type: "H256", optional: true },
    ],
  },

  // ---------------- consensus / proofs ----------------
  babe_epochAuthorship: {
    description: "Slots this node is allowed to author in the current epoch.",
    family: "babe",
    args: [],
  },
  grandpa_proveFinality: {
    description: "Finality proof up to a block (for light clients).",
    family: "grandpa",
    args: [{ name: "blockNumber", type: "u32" }],
  },
  grandpa_roundState: {
    description: "GRANDPA round state (best round, total weight, voters).",
    family: "grandpa",
    args: [],
  },
  grandpa_subscribeJustifications: {
    description: "Subscribe to GRANDPA justifications.",
    family: "grandpa",
    args: [],
    subscription: true,
  },
  beefy_getFinalizedHead: {
    description: "Latest BEEFY-finalized block hash.",
    family: "beefy",
    args: [],
  },
  beefy_subscribeJustifications: {
    description: "Subscribe to BEEFY signed commitments.",
    family: "beefy",
    args: [],
    subscription: true,
  },
  mmr_root: {
    description: "MMR root at a block.",
    family: "mmr",
    args: [{ name: "at", type: "H256", optional: true }],
  },
  mmr_generateProof: {
    description: "Generate an MMR proof for given leaf indices.",
    family: "mmr",
    args: [
      { name: "blockNumbers", type: "u32[]" },
      { name: "bestKnownBlockNumber", type: "u32", optional: true },
      { name: "at", type: "H256", optional: true },
    ],
  },
  mmr_verifyProof: {
    description: "Verify an MMR proof.",
    family: "mmr",
    args: [{ name: "proof", type: "MmrLeavesProof" }],
  },

  // ---------------- offchain ----------------
  offchain_localStorageGet: {
    description: "Read from offchain-worker local storage (PERSISTENT or LOCAL kind).",
    family: "offchain",
    args: [
      { name: "kind", type: "string", description: "PERSISTENT or LOCAL" },
      { name: "key", type: "hex" },
    ],
  },
  offchain_localStorageSet: {
    description: "Write to offchain-worker local storage.",
    family: "offchain",
    args: [
      { name: "kind", type: "string" },
      { name: "key", type: "hex" },
      { name: "value", type: "hex" },
    ],
    dangerous: true,
  },

  // ---------------- dev ----------------
  dev_newBlock: {
    description: "Manually trigger block production (manual-seal dev nodes).",
    family: "dev",
    args: [
      {
        name: "params",
        type: "json",
        optional: true,
        description: "{ create_empty?: bool, finalize?: bool }",
      },
    ],
    dangerous: true,
  },
  dev_setHead: {
    description: "Set the chain head to a specific block (manual-seal dev nodes).",
    family: "dev",
    args: [{ name: "blockHash", type: "H256" }],
    dangerous: true,
  },

  // ---------------- discovery ----------------
  rpc_methods: {
    description: "List of JSON-RPC methods this node exposes.",
    family: "spec",
    args: [],
  },

  // ---------------- new-spec: chainSpec ----------------
  chainSpec_v1_chainName: {
    description: "Chain name from the chain spec (no SCALE).",
    family: "chainSpec",
    args: [],
  },
  chainSpec_v1_genesisHash: {
    description: "Genesis block hash.",
    family: "chainSpec",
    args: [],
  },
  chainSpec_v1_properties: {
    description: "Chain properties from the chain spec.",
    family: "chainSpec",
    args: [],
  },

  // ---------------- new-spec: archive ----------------
  archive_v1_finalizedHeight: {
    description: "Latest finalized block number this archive node has.",
    family: "archive",
    args: [],
  },
  archive_v1_genesisHash: {
    description: "Genesis block hash from the archive node.",
    family: "archive",
    args: [],
  },
  archive_v1_hashByHeight: {
    description: "Block hashes at a height (canonical + forks).",
    family: "archive",
    args: [{ name: "height", type: "u32" }],
  },
  archive_v1_header: {
    description: "Header for an archived block.",
    family: "archive",
    args: [{ name: "blockHash", type: "H256" }],
  },
  archive_v1_body: {
    description: "Block body (extrinsics) for an archived block.",
    family: "archive",
    args: [{ name: "blockHash", type: "H256" }],
  },
  archive_v1_call: {
    description: "Invoke a runtime API at an archived block.",
    family: "archive",
    args: [
      { name: "blockHash", type: "H256" },
      { name: "function", type: "string" },
      { name: "callParameters", type: "hex" },
    ],
  },
  archive_v1_storage: {
    description: "Read storage at an archived block.",
    family: "archive",
    args: [
      { name: "blockHash", type: "H256" },
      { name: "items", type: "StorageItemInput[]" },
      { name: "childTrie", type: "string", optional: true },
    ],
    subscription: true,
  },

  // ---------------- new-spec: chainHead / transaction (subscription-only) ----------------
  chainHead_v1_follow: {
    description: "Pin chainHead and stream block events. Requires a follow session.",
    family: "chainHead",
    args: [{ name: "withRuntime", type: "bool" }],
    subscription: true,
  },
  transaction_v1_broadcast: {
    description: "Broadcast a signed extrinsic and watch its status.",
    family: "transaction",
    args: [{ name: "extrinsic", type: "hex" }],
    dangerous: true,
    subscription: true,
  },
};

/** Detect family from a method name when it isn't in the registry. */
export function inferFamily(method: string): RpcFamily {
  const prefix = method.split("_")[0];
  switch (prefix) {
    case "system":
    case "chain":
    case "state":
    case "author":
    case "payment":
    case "babe":
    case "grandpa":
    case "beefy":
    case "mmr":
    case "offchain":
    case "dev":
      return prefix;
    case "rpc":
      return "spec";
    case "chainHead":
      return "chainHead";
    case "chainSpec":
      return "chainSpec";
    case "transaction":
      return "transaction";
    case "archive":
      return "archive";
    default:
      return "other";
  }
}
