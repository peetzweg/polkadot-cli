import { mock } from "bun:test";

// bun's mock.module() is global to the test process and is NOT restored
// between files, so any test file that mocks "polkadot-api" must keep every
// real export intact — other in-process tests import Binary etc. from it.
// Real modules are captured before mock.module so the spreads below do that.
const actualPapi = await import("polkadot-api");
const actualWs = await import("polkadot-api/ws");

export const mockGetWsProvider = mock((_endpoints: any, _config?: any) => (() => {}) as any);
export const mockCreateClient = mock(
  () =>
    ({
      destroy: () => {},
    }) as any,
);

mock.module("polkadot-api", () => ({ ...actualPapi, createClient: mockCreateClient }));
mock.module("polkadot-api/ws", () => ({ ...actualWs, getWsProvider: mockGetWsProvider }));

// Capture the real createChainClient before any test file stubs the whole
// client.ts module (load-meta.test.ts does) — file evaluation order depends
// on test scheduling, so client.test.ts cannot rely on importing it itself.
export const { createChainClient } = await import("../client.ts");
