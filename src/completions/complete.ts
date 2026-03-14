import { loadAccounts } from "../config/accounts-store.ts";
import { loadConfig, loadMetadata } from "../config/store.ts";
import type { Config } from "../config/types.ts";
import { DEV_NAMES } from "../core/accounts.ts";
import { getAlgorithmNames } from "../core/hash.ts";
import type { PalletInfo } from "../core/metadata.ts";
import { listPallets, parseMetadata } from "../core/metadata.ts";

const CATEGORIES = ["query", "tx", "const", "events", "errors"] as const;

const CATEGORY_ALIASES: Record<string, string> = {
  query: "query",
  tx: "tx",
  const: "const",
  consts: "const",
  constants: "const",
  events: "events",
  event: "events",
  errors: "errors",
  error: "errors",
};

const NAMED_COMMANDS = ["chain", "account", "inspect", "hash", "completions"];

const CHAIN_SUBCOMMANDS = ["add", "remove", "update", "list", "default"];
const ACCOUNT_SUBCOMMANDS = [
  "add",
  "create",
  "new",
  "import",
  "derive",
  "list",
  "remove",
  "delete",
  "inspect",
];

const GLOBAL_OPTIONS = ["--chain", "--rpc", "--light-client", "--output", "--help", "--version"];
const TX_OPTIONS = ["--from", "--dry-run", "--encode", "--ext"];
const QUERY_OPTIONS = ["--limit"];

function matchCategory(s: string): string | undefined {
  return CATEGORY_ALIASES[s.toLowerCase()];
}

async function loadPallets(_config: Config, chainName: string): Promise<PalletInfo[] | null> {
  const raw = await loadMetadata(chainName);
  if (!raw) return null;
  const meta = parseMetadata(raw);
  return listPallets(meta);
}

function filterPallets(pallets: PalletInfo[], category: string): PalletInfo[] {
  switch (category) {
    case "query":
      return pallets.filter((p) => p.storage.length > 0);
    case "tx":
      return pallets.filter((p) => p.calls.length > 0);
    case "const":
      return pallets.filter((p) => p.constants.length > 0);
    case "events":
      return pallets.filter((p) => p.events.length > 0);
    case "errors":
      return pallets.filter((p) => p.errors.length > 0);
    default:
      return pallets;
  }
}

function getItemNames(pallet: PalletInfo, category: string): string[] {
  switch (category) {
    case "query":
      return pallet.storage.map((s) => s.name);
    case "tx":
      return pallet.calls.map((c) => c.name);
    case "const":
      return pallet.constants.map((c) => c.name);
    case "events":
      return pallet.events.map((e) => e.name);
    case "errors":
      return pallet.errors.map((e) => e.name);
    default:
      return [];
  }
}

function resolveChainFromArgs(precedingWords: string[], _config: Config): string | undefined {
  // Check for --chain <name> in preceding words
  for (let i = 0; i < precedingWords.length - 1; i++) {
    if (precedingWords[i] === "--chain") {
      return precedingWords[i + 1];
    }
  }
  return undefined;
}

function filterPrefix(candidates: string[], prefix: string): string[] {
  if (!prefix) return candidates;
  const lower = prefix.toLowerCase();
  return candidates.filter((c) => c.toLowerCase().startsWith(lower));
}

export async function generateCompletions(
  currentWord: string,
  precedingWords: string[],
): Promise<string[]> {
  const config = await loadConfig();
  const knownChains = Object.keys(config.chains);

  // 1. Option value completion
  const prevWord = precedingWords[precedingWords.length - 1];
  if (prevWord === "--chain") {
    return filterPrefix(knownChains, currentWord);
  }
  if (prevWord === "--output") {
    return filterPrefix(["pretty", "json"], currentWord);
  }
  if (prevWord === "--from") {
    const accounts = await loadAccounts();
    const names = [...DEV_NAMES, ...accounts.accounts.map((a) => a.name)];
    return filterPrefix(names, currentWord);
  }

  // 2. Option name completion
  if (currentWord.startsWith("--")) {
    // Determine active category from preceding words
    const activeCategory = detectCategory(precedingWords, knownChains);
    const options = [...GLOBAL_OPTIONS];
    if (activeCategory === "tx") options.push(...TX_OPTIONS);
    if (activeCategory === "query") options.push(...QUERY_OPTIONS);
    return filterPrefix(options, currentWord);
  }

  // 3. Named subcommand completion
  const firstArg = precedingWords.find((w) => !w.startsWith("-"));
  if (firstArg === "chain") {
    return filterPrefix(CHAIN_SUBCOMMANDS, currentWord);
  }
  if (firstArg === "account") {
    return filterPrefix(ACCOUNT_SUBCOMMANDS, currentWord);
  }
  if (firstArg === "hash") {
    return filterPrefix(getAlgorithmNames(), currentWord);
  }

  // 4. Dotpath completion
  return completeDotpath(currentWord, config, knownChains, precedingWords);
}

function detectCategory(words: string[], _knownChains: string[]): string | undefined {
  for (const w of words) {
    if (w.startsWith("-")) continue;
    // Try as dotpath
    const parts = w.split(".");
    for (const part of parts) {
      const cat = matchCategory(part);
      if (cat) return cat;
    }
  }
  return undefined;
}

async function completeDotpath(
  currentWord: string,
  config: Config,
  knownChains: string[],
  precedingWords: string[],
): Promise<string[]> {
  const endsWithDot = currentWord.endsWith(".");
  const parts = currentWord.split(".");
  // completeSegments: all parts except the trailing partial (or empty string after final dot)
  const completeSegments = parts.slice(0, -1);
  const partial = endsWithDot ? "" : (parts[parts.length - 1] ?? "");
  const numComplete = completeSegments.length;

  // Top-level: no complete segments, typing a partial
  if (numComplete === 0 && !endsWithDot) {
    const candidates = [...CATEGORIES.map(String), ...knownChains, ...NAMED_COMMANDS];
    return filterPrefix(candidates, partial);
  }

  const first = completeSegments[0] ?? "";
  const firstIsCategory = matchCategory(first) !== undefined;
  const firstIsChain = knownChains.some((c) => c.toLowerCase() === first.toLowerCase());

  // Determine chain for metadata loading
  const chainFromFlag = resolveChainFromArgs(precedingWords, config);

  if (firstIsCategory) {
    const category = matchCategory(first)!;

    if (numComplete === 1 && endsWithDot) {
      // "category." → pallet names
      const chainName = chainFromFlag ?? config.defaultChain;
      const pallets = await loadPallets(config, chainName);
      if (!pallets) return [];
      const filtered = filterPallets(pallets, category);
      const candidates = filtered.map((p) => `${first}.${p.name}`);
      return filterPrefix(candidates, currentWord.slice(0, -1));
    }

    if (numComplete === 1 && !endsWithDot) {
      // "category.partial" → filter pallet names
      const chainName = chainFromFlag ?? config.defaultChain;
      const pallets = await loadPallets(config, chainName);
      if (!pallets) return [];
      const filtered = filterPallets(pallets, category);
      const candidates = filtered.map((p) => `${first}.${p.name}`);
      return filterPrefix(candidates, currentWord);
    }

    if (numComplete === 2) {
      // "category.Pallet." or "category.Pallet.partial" → item names
      const palletName = completeSegments[1]!;
      const chainName = chainFromFlag ?? config.defaultChain;
      const pallets = await loadPallets(config, chainName);
      if (!pallets) return [];
      const pallet = pallets.find((p) => p.name.toLowerCase() === palletName.toLowerCase());
      if (!pallet) return [];
      const items = getItemNames(pallet, category);
      const candidates = items.map((i) => `${first}.${palletName}.${i}`);
      return filterPrefix(candidates, endsWithDot ? currentWord.slice(0, -1) : currentWord);
    }

    return [];
  }

  if (firstIsChain) {
    const chainName = first;

    if (numComplete === 1 && endsWithDot) {
      // "chain." → categories
      const candidates = CATEGORIES.map((c) => `${first}.${c}`);
      return filterPrefix(candidates, currentWord.slice(0, -1));
    }

    if (numComplete === 1 && !endsWithDot) {
      // "chain.partial" → filter categories
      const candidates = CATEGORIES.map((c) => `${first}.${c}`);
      return filterPrefix(candidates, currentWord);
    }

    if (numComplete === 2) {
      // "chain.category." or "chain.category.partial" → pallet names
      const category = matchCategory(completeSegments[1]!);
      if (!category) return [];
      const pallets = await loadPallets(config, chainName);
      if (!pallets) return [];
      const filtered = filterPallets(pallets, category);
      const prefix = `${first}.${completeSegments[1]!}`;
      const candidates = filtered.map((p) => `${prefix}.${p.name}`);
      return filterPrefix(candidates, endsWithDot ? currentWord.slice(0, -1) : currentWord);
    }

    if (numComplete === 3) {
      // "chain.category.Pallet." or "chain.category.Pallet.partial" → items
      const category = matchCategory(completeSegments[1]!);
      if (!category) return [];
      const palletName = completeSegments[2]!;
      const pallets = await loadPallets(config, chainName);
      if (!pallets) return [];
      const pallet = pallets.find((p) => p.name.toLowerCase() === palletName.toLowerCase());
      if (!pallet) return [];
      const items = getItemNames(pallet, category);
      const prefix = `${first}.${completeSegments[1]!}.${palletName}`;
      const candidates = items.map((i) => `${prefix}.${i}`);
      return filterPrefix(candidates, endsWithDot ? currentWord.slice(0, -1) : currentWord);
    }

    return [];
  }

  return [];
}
