import { describe, expect, mock, test } from "bun:test";
import type { ChainConfig } from "../config/types.ts";
import { ConnectionError } from "../utils/errors.ts";
import { createChainClient } from "./client.ts";

// Inject fakes via the `deps` argument so we don't replace the real
// polkadot-api module (which other tests depend on for `Binary`, etc.).
const mockGetWsProvider = mock((_endpoints: any, _config?: any) => (() => {}) as any);
const mockCreateClient = mock(
  () =>
    ({
      destroy: () => {},
    }) as any,
);
const deps = {
  getWsProvider: mockGetWsProvider as any,
  createClient: mockCreateClient as any,
};

describe("createChainClient", () => {
  test("passes timeout config to getWsProvider", async () => {
    mockGetWsProvider.mockClear();

    const handle = await createChainClient(
      "test-chain",
      { rpc: "wss://example.com" },
      "wss://example.com",
      deps,
    );

    expect(mockGetWsProvider).toHaveBeenCalledTimes(1);
    const [endpoints, config] = mockGetWsProvider.mock.calls[0]!;
    expect(endpoints).toBe("wss://example.com");
    expect(config).toHaveProperty("timeout", 10_000);

    handle.destroy();
  });

  test("does not pass websocketClass (papi v2 auto-detects WebSocket)", async () => {
    mockGetWsProvider.mockClear();

    const handle = await createChainClient(
      "test-chain",
      { rpc: "wss://example.com" },
      "wss://example.com",
      deps,
    );

    const [, config] = mockGetWsProvider.mock.calls[0]!;
    expect(config).not.toHaveProperty("websocketClass");

    handle.destroy();
  });

  test("does not use withPolkadotSdkCompat wrapper (removed in papi v2)", async () => {
    mockCreateClient.mockClear();

    const handle = await createChainClient(
      "test-chain",
      { rpc: "wss://example.com" },
      "wss://example.com",
      deps,
    );

    // createClient should receive the raw provider, not a compat-wrapped one
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
    const callArgs = mockCreateClient.mock.calls[0]! as unknown[];
    // The provider should be the direct return of getWsProvider (a function)
    expect(typeof callArgs[0]).toBe("function");

    handle.destroy();
  });

  test("passes rpc array as endpoints when rpcOverride is an array", async () => {
    mockGetWsProvider.mockClear();

    const rpcs = ["wss://a.example.com", "wss://b.example.com"];
    const handle = await createChainClient("test-chain", { rpc: rpcs[0]! }, rpcs, deps);

    const [endpoints] = mockGetWsProvider.mock.calls[0]!;
    expect(endpoints).toEqual(rpcs);

    handle.destroy();
  });

  test("uses chainConfig.rpc when no rpcOverride is given", async () => {
    mockGetWsProvider.mockClear();

    const handle = await createChainClient(
      "test-chain",
      { rpc: "wss://config.example.com" },
      undefined,
      deps,
    );

    const [endpoints] = mockGetWsProvider.mock.calls[0]!;
    expect(endpoints).toBe("wss://config.example.com");

    handle.destroy();
  });

  test("throws ConnectionError when no RPC is configured", async () => {
    const noRpc = {} as ChainConfig;
    expect(createChainClient("unknown-chain", noRpc, undefined, deps)).rejects.toThrow(
      ConnectionError,
    );
  });

  test("throws ConnectionError with helpful message", async () => {
    const noRpc = {} as ChainConfig;
    expect(createChainClient("my-chain", noRpc, undefined, deps)).rejects.toThrow(
      /No RPC endpoint configured.*"my-chain"/,
    );
  });

  test("ignores legacy lightClient field and uses RPC", async () => {
    mockGetWsProvider.mockClear();

    // Old configs may have lightClient: true — the field is no longer in the
    // ChainConfig interface but could still exist in user config files on disk.
    const legacyConfig = { rpc: "wss://example.com", lightClient: true } as ChainConfig;
    const handle = await createChainClient("polkadot", legacyConfig, undefined, deps);

    expect(mockGetWsProvider).toHaveBeenCalledTimes(1);
    const [endpoints] = mockGetWsProvider.mock.calls[0]!;
    expect(endpoints).toBe("wss://example.com");

    handle.destroy();
  });

  test("destroy() calls client.destroy()", async () => {
    const destroySpy = mock(() => {});
    mockCreateClient.mockImplementationOnce(
      () =>
        ({
          destroy: destroySpy,
        }) as any,
    );

    const handle = await createChainClient(
      "test-chain",
      { rpc: "wss://example.com" },
      "wss://example.com",
      deps,
    );

    expect(destroySpy).not.toHaveBeenCalled();
    handle.destroy();
    expect(destroySpy).toHaveBeenCalledTimes(1);
  });
});
