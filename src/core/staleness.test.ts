import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getMetadataFingerprintPath, loadMetadataFingerprint } from "../config/store.ts";
import { withDotHome } from "../test-helpers/with-dot-home.ts";
import type { ClientHandle } from "./client.ts";
import { withStalenessSuggestion } from "./metadata.ts";

interface MockClient {
  client: { _request: <T>(method: string, params: unknown[]) => Promise<T> };
  destroy: () => void;
}

function makeMockClient(handler: (method: string) => unknown): MockClient {
  return {
    client: {
      _request: async <T>(method: string): Promise<T> => handler(method) as T,
    },
    destroy: () => {},
  };
}

const STALE_WASM_TRAP = new Error(
  "Execution failed: Execution aborted due to trap: wasm `unreachable` instruction executed",
);

function makeFreshHome(): string {
  const home = mkdtempSync(join(tmpdir(), "dot-staleness-"));
  mkdirSync(join(home, "chains", "polkadot"), { recursive: true });
  return home;
}

function withFingerprint(home: string, fp: object) {
  process.env.DOT_HOME = home;
  writeFileSync(getMetadataFingerprintPath("polkadot"), JSON.stringify(fp));
}

describe("withStalenessSuggestion", () => {
  test("returns the task result on success without doing any RPC", async () => {
    const home = makeFreshHome();
    const client = makeMockClient(() => {
      throw new Error("RPC should not be called on success path");
    });
    try {
      const result = await withDotHome(home, () =>
        withStalenessSuggestion("polkadot", client as unknown as ClientHandle, async () => 42),
      );
      expect(result).toBe(42);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("propagates non-stale errors unchanged (e.g. pallet not found)", async () => {
    const home = makeFreshHome();
    const client = makeMockClient(() => {
      throw new Error("RPC should not be called for non-stale errors");
    });
    try {
      await expect(
        withDotHome(home, () =>
          withStalenessSuggestion("polkadot", client as unknown as ClientHandle, async () => {
            throw new Error("pallet 'Foo' not found");
          }),
        ),
      ).rejects.toThrow("pallet 'Foo' not found");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("propagates the original error when DOT_TRUST_CACHED_METADATA=1", async () => {
    const home = makeFreshHome();
    const client = makeMockClient(() => {
      throw new Error("RPC should not be called when env opt-out is set");
    });
    try {
      await expect(
        withDotHome(
          home,
          () =>
            withStalenessSuggestion("polkadot", client as unknown as ClientHandle, async () => {
              throw STALE_WASM_TRAP;
            }),
          { DOT_TRUST_CACHED_METADATA: "1" },
        ),
      ).rejects.toThrow(/wasm.*unreachable/);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("propagates original error when fingerprint RPC fails", async () => {
    const home = makeFreshHome();
    const client = makeMockClient(() => {
      throw new Error("network down");
    });
    try {
      await expect(
        withDotHome(home, () =>
          withStalenessSuggestion("polkadot", client as unknown as ClientHandle, async () => {
            throw STALE_WASM_TRAP;
          }),
        ),
      ).rejects.toThrow(/wasm.*unreachable/);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("propagates original error when no cached fingerprint exists", async () => {
    const home = makeFreshHome();
    const client = makeMockClient((method) => {
      if (method === "state_getRuntimeVersion") {
        return {
          specName: "polkadot",
          specVersion: 1018,
          transactionVersion: 24,
          implName: "parity-polkadot",
          implVersion: 0,
          authoringVersion: 0,
        };
      }
      if (method === "state_getStorageHash") return "0xfeed";
      throw new Error(`unexpected method: ${method}`);
    });
    try {
      await expect(
        withDotHome(home, () =>
          withStalenessSuggestion("polkadot", client as unknown as ClientHandle, async () => {
            throw STALE_WASM_TRAP;
          }),
        ),
      ).rejects.toThrow(/wasm.*unreachable/);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("propagates original error when cached fingerprint matches live", async () => {
    const home = makeFreshHome();
    const fp = {
      specName: "polkadot",
      specVersion: 1018,
      transactionVersion: 24,
      implName: "parity-polkadot",
      implVersion: 0,
      authoringVersion: 0,
      codeHash: "0xfeed",
      fetchedAt: "2026-04-27T12:00:00Z",
    };
    const client = makeMockClient((method) => {
      if (method === "state_getRuntimeVersion") {
        return {
          specName: fp.specName,
          specVersion: fp.specVersion,
          transactionVersion: fp.transactionVersion,
          implName: fp.implName,
          implVersion: fp.implVersion,
          authoringVersion: fp.authoringVersion,
        };
      }
      if (method === "state_getStorageHash") return "0xfeed";
      throw new Error(`unexpected method: ${method}`);
    });
    try {
      await withDotHome(home, async () => {
        withFingerprint(home, fp);
        expect(await loadMetadataFingerprint("polkadot")).not.toBeNull();
        await expect(
          withStalenessSuggestion("polkadot", client as unknown as ClientHandle, async () => {
            throw STALE_WASM_TRAP;
          }),
        ).rejects.toThrow(/wasm.*unreachable/);
      });
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("wraps with a 'spec X → Y' note when specVersion bumped", async () => {
    const home = makeFreshHome();
    const cached = {
      specName: "polkadot",
      specVersion: 1018,
      transactionVersion: 24,
      implName: "parity-polkadot",
      implVersion: 0,
      authoringVersion: 0,
      codeHash: "0xaaaa",
      fetchedAt: "2026-04-27T12:00:00Z",
    };
    const client = makeMockClient((method) => {
      if (method === "state_getRuntimeVersion") {
        return {
          specName: "polkadot",
          specVersion: 1020,
          transactionVersion: 25,
          implName: "parity-polkadot",
          implVersion: 0,
          authoringVersion: 0,
        };
      }
      if (method === "state_getStorageHash") return "0xbbbb";
      throw new Error(`unexpected method: ${method}`);
    });
    try {
      await withDotHome(home, async () => {
        withFingerprint(home, cached);
        let captured: Error | undefined;
        try {
          await withStalenessSuggestion("polkadot", client as unknown as ClientHandle, async () => {
            throw STALE_WASM_TRAP;
          });
        } catch (err) {
          captured = err as Error;
        }
        expect(captured).toBeDefined();
        expect(captured!.message).toContain('Local metadata for "polkadot" is out of date');
        expect(captured!.message).toContain("spec 1018 → 1020");
        expect(captured!.message).toContain("dot chain update polkadot");
      });
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("wraps with code-hash note when only codeHash differs (same spec)", async () => {
    const home = makeFreshHome();
    const cached = {
      specName: "polkadot",
      specVersion: 1018,
      transactionVersion: 24,
      implName: "parity-polkadot",
      implVersion: 0,
      authoringVersion: 0,
      codeHash: "0xCACHED",
      fetchedAt: "2026-04-27T12:00:00Z",
    };
    const client = makeMockClient((method) => {
      if (method === "state_getRuntimeVersion") {
        return {
          specName: "polkadot",
          specVersion: 1018, // same spec
          transactionVersion: 24,
          implName: "parity-polkadot",
          implVersion: 0,
          authoringVersion: 0,
        };
      }
      if (method === "state_getStorageHash") return "0xLIVE"; // different code
      throw new Error(`unexpected method: ${method}`);
    });
    try {
      await withDotHome(home, async () => {
        withFingerprint(home, cached);
        let captured: Error | undefined;
        try {
          await withStalenessSuggestion("polkadot", client as unknown as ClientHandle, async () => {
            throw STALE_WASM_TRAP;
          });
        } catch (err) {
          captured = err as Error;
        }
        expect(captured).toBeDefined();
        expect(captured!.message).toContain("code hash changed");
        expect(captured!.message).toContain("same spec 1018");
        expect(captured!.message).toContain("dot chain update polkadot");
      });
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
