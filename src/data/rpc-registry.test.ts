import { describe, expect, test } from "bun:test";
import { inferFamily, RPC_REGISTRY } from "./rpc-registry.ts";

describe("RPC_REGISTRY", () => {
  test("every entry has a family and description", () => {
    for (const [method, info] of Object.entries(RPC_REGISTRY)) {
      expect(info.family, `${method} missing family`).toBeTruthy();
      expect(info.description, `${method} missing description`).toBeTruthy();
      expect(info.description.length, `${method} description too short`).toBeGreaterThan(5);
    }
  });

  test("dangerous methods include state-changing flavors", () => {
    expect(RPC_REGISTRY.author_insertKey?.dangerous).toBe(true);
    expect(RPC_REGISTRY.author_rotateKeys?.dangerous).toBe(true);
    expect(RPC_REGISTRY.author_submitExtrinsic?.dangerous).toBe(true);
    expect(RPC_REGISTRY.dev_newBlock?.dangerous).toBe(true);
    expect(RPC_REGISTRY.dev_setHead?.dangerous).toBe(true);
    expect(RPC_REGISTRY.system_addLogFilter?.dangerous).toBe(true);
    expect(RPC_REGISTRY.offchain_localStorageSet?.dangerous).toBe(true);
  });

  test("read-only methods are not flagged dangerous", () => {
    expect(RPC_REGISTRY.system_health?.dangerous).toBeFalsy();
    expect(RPC_REGISTRY.chain_getBlock?.dangerous).toBeFalsy();
    expect(RPC_REGISTRY.payment_queryInfo?.dangerous).toBeFalsy();
    expect(RPC_REGISTRY.rpc_methods?.dangerous).toBeFalsy();
  });

  test("subscription methods are flagged", () => {
    expect(RPC_REGISTRY.chain_subscribeAllHeads?.subscription).toBe(true);
    expect(RPC_REGISTRY.chain_subscribeFinalizedHeads?.subscription).toBe(true);
    expect(RPC_REGISTRY.chain_subscribeNewHeads?.subscription).toBe(true);
    expect(RPC_REGISTRY.state_subscribeStorage?.subscription).toBe(true);
    expect(RPC_REGISTRY.chainHead_v1_follow?.subscription).toBe(true);
    expect(RPC_REGISTRY.transaction_v1_broadcast?.subscription).toBe(true);
  });

  test("required args precede optional args (so positional parsing is unambiguous)", () => {
    for (const [method, info] of Object.entries(RPC_REGISTRY)) {
      let seenOptional = false;
      for (const arg of info.args) {
        if (arg.optional) {
          seenOptional = true;
        } else if (seenOptional) {
          throw new Error(`${method}: required arg "${arg.name}" follows an optional arg`);
        }
      }
    }
  });
});

describe("inferFamily", () => {
  test("maps standard prefixes by underscore", () => {
    expect(inferFamily("system_health")).toBe("system");
    expect(inferFamily("chain_getBlock")).toBe("chain");
    expect(inferFamily("state_getStorage")).toBe("state");
    expect(inferFamily("author_pendingExtrinsics")).toBe("author");
    expect(inferFamily("payment_queryInfo")).toBe("payment");
    expect(inferFamily("babe_epochAuthorship")).toBe("babe");
    expect(inferFamily("grandpa_proveFinality")).toBe("grandpa");
    expect(inferFamily("beefy_getFinalizedHead")).toBe("beefy");
    expect(inferFamily("mmr_root")).toBe("mmr");
    expect(inferFamily("offchain_localStorageGet")).toBe("offchain");
    expect(inferFamily("dev_newBlock")).toBe("dev");
  });

  test("maps new-spec prefixes", () => {
    expect(inferFamily("chainHead_v1_follow")).toBe("chainHead");
    expect(inferFamily("chainSpec_v1_chainName")).toBe("chainSpec");
    expect(inferFamily("transaction_v1_broadcast")).toBe("transaction");
    expect(inferFamily("archive_v1_finalizedHeight")).toBe("archive");
  });

  test("rpc_methods maps to the spec family", () => {
    expect(inferFamily("rpc_methods")).toBe("spec");
  });

  test("unknown prefixes fall back to other", () => {
    expect(inferFamily("custompallet_foo")).toBe("other");
    expect(inferFamily("nounderscore")).toBe("other");
  });
});
