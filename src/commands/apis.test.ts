import { beforeAll, describe, expect, test } from "bun:test";
import { existsSync, linkSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DEFAULT_CONFIG } from "../config/types.ts";
import { runCli } from "./__fixtures__/run-cli.ts";

// ---------------------------------------------------------------------------
// Ensure metadata + config exist in real $HOME for in-process tests.
// Mirrors the setup in query.test.ts so the fixture chain is available.
// ---------------------------------------------------------------------------
const FIXTURE_METADATA = join(import.meta.dir, "__fixtures__/polkadot-metadata.bin");
const DOT_DIR = join(homedir(), ".polkadot");

beforeAll(() => {
  const metaDir = join(DOT_DIR, "chains", "polkadot");
  const metaPath = join(metaDir, "metadata.bin");
  if (!existsSync(metaPath)) {
    mkdirSync(metaDir, { recursive: true });
    linkSync(FIXTURE_METADATA, metaPath);
  }
  const configPath = join(DOT_DIR, "config.json");
  if (!existsSync(configPath)) {
    writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG));
  }
});

// @ts-expect-error Bun supports describe(label, options, fn) at runtime
describe("dot apis --at", { timeout: 15_000 }, () => {
  test("--at best is accepted and threads through to the runtime API call", async () => {
    const { exitCode, stdout } = await runCli(["apis.Core.version", "--at", "best"]);
    expect(exitCode).toBe(0);
    expect(stdout).toBeTruthy();
  }, 15_000);

  test("--at with invalid value errors before hitting the network", async () => {
    const { exitCode, stderr } = await runCli(["apis.Core.version", "--at", "latest"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Invalid --at");
  });

  test("--at with a never-pinned hash produces a clean archive-endpoint hint", async () => {
    const fakeHash = `0x${"ab".repeat(32)}`;
    const { exitCode, stderr } = await runCli(["apis.Core.version", "--at", fakeHash]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("archive endpoint");
    expect(stderr).toContain("--rpc wss://<archive-endpoint>");
  }, 15_000);
});
