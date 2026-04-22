import { describe, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadMeta } from "./focused-inspect.ts";

// ---------------------------------------------------------------------------
// Use dependency injection to substitute createChainClient and
// fetchMetadataFromChain in isolation — avoids mock.module, which replaces
// modules globally for the whole `bun test` process and breaks other tests.
// ---------------------------------------------------------------------------
const FIXTURE_METADATA = new Uint8Array(
  readFileSync(join(import.meta.dir, "__fixtures__/polkadot-metadata.bin")),
);

const mockDestroy = mock(() => {});
const mockCreateChainClient = mock(async () => ({
  client: {} as any,
  destroy: mockDestroy,
}));
const mockFetchMetadataFromChain = mock(async () => FIXTURE_METADATA);

const deps = {
  createChainClient: mockCreateChainClient as any,
  fetchMetadataFromChain: mockFetchMetadataFromChain as any,
};

// ---------------------------------------------------------------------------
// loadMeta — --rpc override bypasses metadata cache
// ---------------------------------------------------------------------------
describe("loadMeta", () => {
  const chainConfig = { rpc: "wss://default.example.com" };

  test("bypasses cache and fetches fresh metadata when rpcOverride is provided", async () => {
    mockCreateChainClient.mockClear();
    mockFetchMetadataFromChain.mockClear();
    mockDestroy.mockClear();

    const meta = await loadMeta("polkadot", chainConfig, "wss://override.example.com", deps);

    expect(meta).toBeDefined();
    expect(meta.unified).toBeDefined();
    expect(mockCreateChainClient).toHaveBeenCalledTimes(1);
    const callArgs = mockCreateChainClient.mock.calls[0] as unknown as unknown[];
    expect(callArgs[0]).toBe("polkadot");
    expect(callArgs[2]).toBe("wss://override.example.com");
    expect(mockFetchMetadataFromChain).toHaveBeenCalledTimes(1);
  });

  test("destroys client handle after fetching with rpcOverride", async () => {
    mockDestroy.mockClear();

    await loadMeta("polkadot", chainConfig, "wss://override.example.com", deps);

    expect(mockDestroy).toHaveBeenCalledTimes(1);
  });

  test("uses cache when no rpcOverride is provided", async () => {
    mockCreateChainClient.mockClear();
    mockFetchMetadataFromChain.mockClear();

    // Without rpcOverride, loadMeta calls getOrFetchMetadata(chainName) which
    // reads from cache. The real getOrFetchMetadata calls the real loadMetadata
    // from store.ts — if cached metadata exists on disk, no client is created.
    const meta = await loadMeta("polkadot", chainConfig, undefined, deps);

    expect(meta).toBeDefined();
    expect(meta.unified).toBeDefined();
    // Cache hit — no client created, no network fetch
    expect(mockCreateChainClient).not.toHaveBeenCalled();
    expect(mockFetchMetadataFromChain).not.toHaveBeenCalled();
  });
});
