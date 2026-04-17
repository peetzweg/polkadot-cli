import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { CliError } from "../utils/errors.ts";
import type { ChainConfig, Config } from "./types.ts";
import { DEFAULT_CONFIG } from "./types.ts";

const DOT_DIR = join(homedir(), ".polkadot");
const CONFIG_PATH = join(DOT_DIR, "config.json");
const CHAINS_DIR = join(DOT_DIR, "chains");

export function getConfigDir(): string {
  return DOT_DIR;
}

export function getChainsDir(): string {
  return CHAINS_DIR;
}

export function getChainDir(chainName: string): string {
  return join(CHAINS_DIR, chainName);
}

export function getMetadataPath(chainName: string): string {
  return join(CHAINS_DIR, chainName, "metadata.bin");
}

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function loadConfig(): Promise<Config> {
  await ensureDir(DOT_DIR);
  if (await fileExists(CONFIG_PATH)) {
    const saved = JSON.parse(await readFile(CONFIG_PATH, "utf-8")) as Config;
    const chains: Record<string, ChainConfig> = {};
    for (const [name, defaultConfig] of Object.entries(DEFAULT_CONFIG.chains)) {
      chains[name] = saved.chains[name]
        ? { ...defaultConfig, ...saved.chains[name] }
        : defaultConfig;
    }
    for (const [name, config] of Object.entries(saved.chains)) {
      if (!(name in DEFAULT_CONFIG.chains)) {
        chains[name] = config;
      }
    }
    return { chains };
  }
  await saveConfig(DEFAULT_CONFIG);
  return DEFAULT_CONFIG;
}

export async function saveConfig(config: Config): Promise<void> {
  await ensureDir(DOT_DIR);
  await writeFile(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
}

export async function loadMetadata(chainName: string): Promise<Uint8Array | null> {
  const path = getMetadataPath(chainName);
  if (await fileExists(path)) {
    return await readFile(path);
  }
  return null;
}

export async function saveMetadata(chainName: string, data: Uint8Array): Promise<void> {
  const dir = getChainDir(chainName);
  await ensureDir(dir);
  await writeFile(getMetadataPath(chainName), data);
}

export async function removeChainData(chainName: string): Promise<void> {
  const dir = getChainDir(chainName);
  await rm(dir, { recursive: true, force: true });
}

export function findChainName(config: Config, input: string): string | undefined {
  if (config.chains[input]) return input;
  return Object.keys(config.chains).find((k) => k.toLowerCase() === input.toLowerCase());
}

export function resolveChain(
  config: Config,
  chainFlag: string | undefined,
): { name: string; chain: ChainConfig } {
  const available = Object.keys(config.chains).join(", ");
  if (!chainFlag) {
    throw new CliError(
      `No chain specified. Pass --chain <name> or use a dotpath prefix (e.g. "dot polkadot.query.System.Number"). Available chains: ${available}`,
    );
  }
  const name = findChainName(config, chainFlag);
  if (!name) {
    throw new CliError(`Unknown chain "${chainFlag}". Available chains: ${available}`);
  }
  return { name, chain: config.chains[name]! };
}
