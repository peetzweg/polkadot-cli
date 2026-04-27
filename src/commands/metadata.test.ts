import { describe, expect, test } from "bun:test";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_CONFIG } from "../config/types.ts";
import { parseMetadata } from "../core/metadata.ts";
import { withDotHome } from "../test-helpers/with-dot-home.ts";
import { runCli } from "./__fixtures__/run-cli.ts";
import { buildMetadataPayload, handleMetadata } from "./metadata.ts";

const FIXTURE_METADATA = join(import.meta.dir, "__fixtures__", "polkadot-metadata.bin");

describe("buildMetadataPayload", () => {
  test("payload has the expected top-level shape", async () => {
    const raw = await Bun.file(FIXTURE_METADATA).bytes();
    const meta = parseMetadata(raw);
    const payload = buildMetadataPayload("polkadot", meta, null);

    expect(payload.chain).toBe("polkadot");
    expect(payload.runtime.metadataVersion).toBeGreaterThanOrEqual(14);
    expect(Array.isArray(payload.pallets)).toBe(true);
    expect(Array.isArray(payload.runtimeApis)).toBe(true);
    expect(Array.isArray(payload.transactionExtensions)).toBe(true);
  });

  test("pallets include System with calls / events / errors / storage / constants", async () => {
    const raw = await Bun.file(FIXTURE_METADATA).bytes();
    const meta = parseMetadata(raw);
    const payload = buildMetadataPayload("polkadot", meta, null);

    const system = payload.pallets.find((p) => p.name === "System");
    expect(system).toBeDefined();
    expect(system!.calls.length).toBeGreaterThan(0);
    expect(system!.events.length).toBeGreaterThan(0);
    expect(system!.errors.length).toBeGreaterThan(0);
    expect(system!.storage.length).toBeGreaterThan(0);
    expect(system!.constants.length).toBeGreaterThan(0);
  });

  test("transactionExtensions include common signed extensions", async () => {
    const raw = await Bun.file(FIXTURE_METADATA).bytes();
    const meta = parseMetadata(raw);
    const payload = buildMetadataPayload("polkadot", meta, null);

    const idents = payload.transactionExtensions.map((e) => e.identifier);
    expect(idents).toContain("CheckMortality");
    expect(idents).toContain("CheckNonce");
  });

  test("runtime block merges fingerprint when supplied", async () => {
    const raw = await Bun.file(FIXTURE_METADATA).bytes();
    const meta = parseMetadata(raw);
    const fingerprint = {
      specName: "polkadot",
      specVersion: 1018,
      transactionVersion: 24,
      implName: "parity-polkadot",
      implVersion: 0,
      authoringVersion: 0,
      codeHash: "0xabcd",
      fetchedAt: "2026-04-27T12:00:00Z",
    };
    const payload = buildMetadataPayload("polkadot", meta, fingerprint);

    expect(payload.runtime.specVersion).toBe(1018);
    expect(payload.runtime.codeHash).toBe("0xabcd");
    expect(payload.runtime.metadataVersion).toBeGreaterThanOrEqual(14);
  });
});

describe("dot metadata (CLI)", () => {
  test("--cached prints decoded JSON with the fixture metadata", async () => {
    const { stdout, exitCode } = await runCli(["metadata", "polkadot", "--cached"], {
      noDefaultChain: true,
    });
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.chain).toBe("polkadot");
    expect(parsed.runtime.metadataVersion).toBeGreaterThanOrEqual(14);
    expect(parsed.pallets.some((p: { name: string }) => p.name === "System")).toBe(true);
    expect(parsed.transactionExtensions.length).toBeGreaterThan(0);
  });

  test("--cached --raw prints a single 0x hex line", async () => {
    const { stdout, exitCode } = await runCli(["metadata", "polkadot", "--cached", "--raw"], {
      noDefaultChain: true,
    });
    expect(exitCode).toBe(0);
    expect(stdout.startsWith("0x")).toBe(true);
    expect(stdout).not.toContain("\n");
    expect(/^0x[0-9a-f]+$/i.test(stdout)).toBe(true);
  });

  test("errors with a clear message when the chain is not configured", async () => {
    const { stderr, exitCode } = await runCli(["metadata", "made-up-chain", "--cached"], {
      noDefaultChain: true,
    });
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Unknown chain");
  });
});

// In-process unit tests for handleMetadata. These run the handler directly
// (not through a subprocess) so the coverage tooling can measure which
// lines run. process.env.DOT_HOME mutations are serialized by withDotHome
// against other tests in this file; bun's per-file process.env isolation
// keeps cross-file tests safe.

function setupHome(withFixture: boolean): string {
  const tmpHome = mkdtempSync(join(tmpdir(), "dot-metadata-handler-"));
  if (withFixture) {
    const polkadotDir = join(tmpHome, "chains", "polkadot");
    mkdirSync(polkadotDir, { recursive: true });
    copyFileSync(FIXTURE_METADATA, join(polkadotDir, "metadata.bin"));
  }
  writeFileSync(join(tmpHome, "config.json"), JSON.stringify(DEFAULT_CONFIG));
  return tmpHome;
}

describe("handleMetadata --cached", () => {
  test("writes JSON with the expected shape against fixture metadata", async () => {
    const home = setupHome(true);
    const captured: string[] = [];
    try {
      await withDotHome(home, async () => {
        const restore = patchConsoleLog((msg) => captured.push(msg));
        try {
          await handleMetadata("polkadot", { cached: true });
        } finally {
          restore();
        }
      });
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
    expect(captured.length).toBe(1);
    const parsed = JSON.parse(captured[0]!);
    expect(parsed.chain).toBe("polkadot");
    expect(parsed.runtime.metadataVersion).toBeGreaterThanOrEqual(14);
    expect(parsed.pallets.length).toBeGreaterThan(0);
    expect(parsed.transactionExtensions.length).toBeGreaterThan(0);
  });

  test("--cached --raw writes a single 0x hex line", async () => {
    const home = setupHome(true);
    const captured: string[] = [];
    try {
      await withDotHome(home, async () => {
        const restore = patchConsoleLog((msg) => captured.push(msg));
        try {
          await handleMetadata("polkadot", { cached: true, raw: true });
        } finally {
          restore();
        }
      });
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
    expect(captured.length).toBe(1);
    expect(captured[0]!.startsWith("0x")).toBe(true);
  });

  test("--cached on chain with no cached metadata throws CliError", async () => {
    const home = setupHome(false);
    try {
      await expect(
        withDotHome(home, () => handleMetadata("polkadot", { cached: true })),
      ).rejects.toThrow(/No cached metadata/);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("rejects unknown chains", async () => {
    const home = setupHome(false);
    try {
      await expect(
        withDotHome(home, () => handleMetadata("made-up", { cached: true })),
      ).rejects.toThrow(/Unknown chain/);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

function patchConsoleLog(capture: (msg: string) => void): () => void {
  const original = console.log;
  console.log = (msg?: unknown) => capture(typeof msg === "string" ? msg : String(msg));
  return () => {
    console.log = original;
  };
}
