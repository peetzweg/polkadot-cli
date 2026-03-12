import { describe, expect, mock, test } from "bun:test";
import { WebSocket } from "ws";
import type { ChainConfig } from "../config/types.ts";
import { ConnectionError } from "../utils/errors.ts";

// Capture calls to getWsProvider so we can inspect the config it receives
const mockGetWsProvider = mock((_endpoints: any, _config?: any) => (() => {}) as any);
const mockWithCompat = mock((p: any) => p);
const mockCreateClient = mock(
  () =>
    ({
      destroy: () => {},
    }) as any,
);

mock.module("polkadot-api/ws-provider", () => ({
  getWsProvider: mockGetWsProvider,
}));
mock.module("polkadot-api/polkadot-sdk-compat", () => ({
  withPolkadotSdkCompat: mockWithCompat,
}));
mock.module("polkadot-api", () => ({
  createClient: mockCreateClient,
}));

// Import after mocking so the mocks take effect
const { createChainClient } = await import("./client.ts");

describe("createChainClient", () => {
  test("passes websocketClass to getWsProvider", async () => {
    mockGetWsProvider.mockClear();

    const handle = await createChainClient(
      "test-chain",
      { rpc: "wss://example.com" },
      "wss://example.com",
    );

    expect(mockGetWsProvider).toHaveBeenCalledTimes(1);
    const [endpoints, config] = mockGetWsProvider.mock.calls[0]!;
    expect(endpoints).toBe("wss://example.com");
    expect(config).toHaveProperty("timeout", 10_000);
    expect(config).toHaveProperty("websocketClass");
    expect(config!.websocketClass).toBe(WebSocket);

    handle.destroy();
  });

  test("passes rpc array as endpoints when rpcOverride is an array", async () => {
    mockGetWsProvider.mockClear();

    const rpcs = ["wss://a.example.com", "wss://b.example.com"];
    const handle = await createChainClient("test-chain", { rpc: rpcs[0]! }, rpcs);

    const [endpoints] = mockGetWsProvider.mock.calls[0]!;
    expect(endpoints).toEqual(rpcs);

    handle.destroy();
  });

  test("uses chainConfig.rpc when no rpcOverride is given", async () => {
    mockGetWsProvider.mockClear();

    const handle = await createChainClient("test-chain", {
      rpc: "wss://config.example.com",
    });

    const [endpoints] = mockGetWsProvider.mock.calls[0]!;
    expect(endpoints).toBe("wss://config.example.com");

    handle.destroy();
  });

  test("throws ConnectionError when no RPC is configured", async () => {
    const noRpc = {} as ChainConfig;
    expect(createChainClient("unknown-chain", noRpc)).rejects.toThrow(ConnectionError);
  });

  test("throws ConnectionError with helpful message", async () => {
    const noRpc = {} as ChainConfig;
    expect(createChainClient("my-chain", noRpc)).rejects.toThrow(
      /No RPC endpoint configured.*"my-chain"/,
    );
  });

  test("wraps provider with withPolkadotSdkCompat", async () => {
    mockWithCompat.mockClear();

    const handle = await createChainClient(
      "test-chain",
      { rpc: "wss://example.com" },
      "wss://example.com",
    );

    expect(mockWithCompat).toHaveBeenCalledTimes(1);

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
    );

    expect(destroySpy).not.toHaveBeenCalled();
    handle.destroy();
    expect(destroySpy).toHaveBeenCalledTimes(1);
  });
});

describe("WebSocket class availability", () => {
  test("ws package exports a WebSocket class", () => {
    expect(WebSocket).toBeDefined();
    expect(typeof WebSocket).toBe("function");
  });

  test("ws WebSocket is constructable", () => {
    // Verify it has the constructor shape expected by the provider
    expect(WebSocket.prototype).toBeDefined();
    expect(typeof WebSocket.prototype.close).toBe("function");
    expect(typeof WebSocket.prototype.send).toBe("function");
  });
});
