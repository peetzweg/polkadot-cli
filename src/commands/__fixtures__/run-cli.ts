import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
  rmSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import type { StoredAccount } from "../../config/accounts-types.ts";
import type { Config, ChainConfig } from "../../config/types.ts";

const FIXTURE_METADATA = join(import.meta.dir, "polkadot-metadata.bin");
const CLI_PATH = join(import.meta.dir, "../../cli.ts");

export const TEST_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

export interface RunCliOptions {
  accounts?: StoredAccount[];
  config?: Partial<Config>;
  files?: Record<string, string | Uint8Array>;
  stdin?: string | Uint8Array;
}

function deepMergeConfig(
  base: Config,
  override: Partial<Config>,
): Config {
  const merged: Config = {
    defaultChain: override.defaultChain ?? base.defaultChain,
    chains: { ...base.chains },
  };
  if (override.chains) {
    for (const [name, chainConfig] of Object.entries(override.chains)) {
      merged.chains[name] = chainConfig;
    }
  }
  return merged;
}

export async function runCli(
  args: string[],
  options?: RunCliOptions,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const tmpHome = mkdtempSync(join(tmpdir(), "dot-test-"));
  const dotDir = join(tmpHome, ".polkadot");
  const chainDir = join(dotDir, "chains", "polkadot");
  mkdirSync(chainDir, { recursive: true });
  copyFileSync(FIXTURE_METADATA, join(chainDir, "metadata.bin"));

  const baseConfig: Config = {
    defaultChain: "polkadot",
    chains: { polkadot: { rpc: "wss://rpc.polkadot.io" } },
  };
  const finalConfig = options?.config
    ? deepMergeConfig(baseConfig, options.config)
    : baseConfig;

  // Create chain dirs for any additional chains with metadata
  for (const chainName of Object.keys(finalConfig.chains)) {
    if (chainName !== "polkadot") {
      const dir = join(dotDir, "chains", chainName);
      mkdirSync(dir, { recursive: true });
    }
  }

  writeFileSync(
    join(dotDir, "config.json"),
    JSON.stringify(finalConfig),
  );

  if (options?.accounts) {
    writeFileSync(
      join(dotDir, "accounts.json"),
      JSON.stringify({ accounts: options.accounts }),
    );
  }

  if (options?.files) {
    for (const [relativePath, content] of Object.entries(options.files)) {
      const fullPath = join(tmpHome, relativePath);
      mkdirSync(dirname(fullPath), { recursive: true });
      if (typeof content === "string") {
        writeFileSync(fullPath, content);
      } else {
        writeFileSync(fullPath, content);
      }
    }
  }

  // Replace {{HOME}} placeholder in args
  const resolvedArgs = args.map((arg) => arg.replace(/\{\{HOME\}\}/g, tmpHome));

  try {
    const spawnOpts: Parameters<typeof Bun.spawn>[1] = {
      env: { ...process.env, HOME: tmpHome },
      stdout: "pipe",
      stderr: "pipe",
    };

    if (options?.stdin != null) {
      spawnOpts.stdin = new Blob([options.stdin]);
    }

    const proc = Bun.spawn(["bun", CLI_PATH, ...resolvedArgs], spawnOpts);
    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    const exitCode = await proc.exited;
    return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode };
  } finally {
    rmSync(tmpHome, { recursive: true, force: true });
  }
}
