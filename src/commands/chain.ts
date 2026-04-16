import { readFile, writeFile } from "node:fs/promises";
import type { CAC } from "cac";
import {
  findChainName,
  loadConfig,
  removeChainData,
  resolveChain,
  saveConfig,
} from "../config/store.ts";
import {
  BUILTIN_CHAIN_NAMES,
  type ChainConfig,
  type Config,
  DEFAULT_CONFIG,
} from "../config/types.ts";
import { createChainClient, getParachainId } from "../core/client.ts";
import { fetchMetadataFromChain } from "../core/metadata.ts";
import {
  BOLD,
  CHECK_MARK,
  CYAN,
  DIM,
  formatJson,
  GREEN,
  isJsonOutput,
  printHeading,
  RED,
  RESET,
  YELLOW,
} from "../core/output.ts";

const CHAIN_HELP = `
${BOLD}Usage:${RESET}
  $ dot chain add <name> --rpc <url>    Add a chain via WebSocket RPC
  $ dot chain remove <name>             Remove a chain
  $ dot chain update [name]             Re-fetch metadata (default chain if omitted)
  $ dot chain update --all              Re-fetch metadata for all configured chains
  $ dot chain list                      List configured chains
  $ dot chain default <name>            Set the default chain
  $ dot chain export [names...]         Export chain configuration to stdout
  $ dot chain import <file>             Import chain configuration from a file

${BOLD}Examples:${RESET}
  $ dot chain add kusama --rpc wss://kusama-rpc.polkadot.io
  $ dot chain add kusama --rpc wss://kusama-rpc.polkadot.io --rpc wss://kusama-rpc.dwellir.com
  $ dot chain add my-para --rpc wss://rpc.example.com --relay polkadot
  $ dot chain add my-para --rpc wss://rpc.example.com --relay polkadot --parachain-id 2000
  $ dot chain default kusama
  $ dot chain list
  $ dot chain update
  $ dot chain update kusama
  $ dot chain update --all
  $ dot chain remove kusama
  $ dot chain export
  $ dot chain export my-relay my-para --file my-chains.json
  $ dot chain export --all
  $ dot chain import my-chains.json
  $ dot chain import my-chains.json --dry-run
  $ dot chain import my-chains.json --overwrite
`.trimStart();

export function registerChainCommands(cli: CAC) {
  cli
    .command(
      "chain [action] [...names]",
      "Manage chains (add, remove, update, list, default, export, import)",
    )
    .alias("chains")
    .option("--all", "Update/export all configured chains")
    .option("--relay <name>", "Parent relay chain for this parachain")
    .option("--parachain-id <id>", "Parachain ID (auto-detected if omitted with --relay)")
    .option("--file <path>", "Output/input file for export/import")
    .option("--overwrite", "Overwrite existing chains on import")
    .option("--dry-run", "Preview import without applying changes")
    .action(
      async (
        action: string | undefined,
        names: string[],
        opts: {
          rpc?: string | string[];
          all?: boolean;
          relay?: string;
          parachainId?: string;
          file?: string;
          overwrite?: boolean;
          dryRun?: boolean;
          output?: string;
          json?: boolean;
        },
      ) => {
        if (!action) {
          if (process.argv[2] === "chains") return chainList(opts);
          console.log(CHAIN_HELP);
          return;
        }
        switch (action) {
          case "add":
            return chainAdd(names[0], opts);
          case "remove":
            return chainRemove(names[0], opts);
          case "list":
            return chainList(opts);
          case "update":
            return chainUpdate(names[0], opts);
          case "default":
            return chainDefault(names[0], opts);
          case "export":
            return chainExport(names, opts);
          case "import":
            return chainImport(names[0], opts);
          default:
            console.error(`Unknown action "${action}".\n`);
            console.log(CHAIN_HELP);
            process.exit(1);
        }
      },
    );
}

async function chainAdd(
  name: string | undefined,
  opts: {
    rpc?: string | string[];
    relay?: string;
    parachainId?: string;
    output?: string;
    json?: boolean;
  },
) {
  if (!name) {
    console.error("Chain name is required.\n");
    console.error("Usage: dot chain add <name> --rpc <url>");
    process.exit(1);
  }
  if (!opts.rpc) {
    console.error("Must provide --rpc <url>.\n");
    console.error("Usage: dot chain add <name> --rpc <url>");
    process.exit(1);
  }

  const parachainIdRaw = opts.parachainId != null ? Number(opts.parachainId) : undefined;
  if (parachainIdRaw != null && !opts.relay) {
    console.error("Cannot set --parachain-id without --relay.\n");
    console.error("Usage: dot chain add <name> --rpc <url> --relay <relay> --parachain-id <id>");
    process.exit(1);
  }

  const chainConfig: ChainConfig = { rpc: opts.rpc };

  process.stderr.write(`Connecting to ${name}...\n`);
  const clientHandle = await createChainClient(name, chainConfig, opts.rpc);

  try {
    process.stderr.write("Fetching metadata...\n");
    await fetchMetadataFromChain(clientHandle, name);

    if (opts.relay) {
      const config = await loadConfig();
      const relayResolved = findChainName(config, opts.relay);
      if (!relayResolved) {
        throw new Error(
          `Relay chain "${opts.relay}" not found. Add it first with: dot chain add ${opts.relay} --rpc <url>`,
        );
      }
      chainConfig.relay = relayResolved;

      if (parachainIdRaw != null) {
        chainConfig.parachainId = parachainIdRaw;
      } else {
        process.stderr.write("Detecting parachain ID...\n");
        const detected = await getParachainId(clientHandle);
        if (detected != null) {
          chainConfig.parachainId = detected;
          process.stderr.write(`Detected parachain ID: ${detected}\n`);
        } else {
          process.stderr.write(
            "Could not detect parachain ID. Use --parachain-id to set it manually.\n",
          );
        }
      }
    }

    // Only save config after successful connection + metadata fetch
    const config = await loadConfig();
    config.chains[name] = chainConfig;
    await saveConfig(config);

    const result: Record<string, unknown> = { action: "added", chain: name };
    if (chainConfig.relay) result.relay = chainConfig.relay;
    if (chainConfig.parachainId != null) result.parachainId = chainConfig.parachainId;

    if (isJsonOutput(opts)) {
      console.log(formatJson(result));
    } else {
      console.log(`Chain "${name}" added successfully.`);
    }
  } finally {
    clientHandle.destroy();
  }
}

async function chainRemove(
  name: string | undefined,
  opts: { output?: string; json?: boolean } = {},
) {
  if (!name) {
    console.error("Usage: dot chain remove <name>");
    process.exit(1);
  }

  const config = await loadConfig();

  const resolved = findChainName(config, name);
  if (!resolved) {
    throw new Error(`Chain "${name}" not found.`);
  }

  if (BUILTIN_CHAIN_NAMES.has(resolved)) {
    throw new Error(`Cannot remove the built-in "${resolved}" chain.`);
  }

  const orphans = Object.entries(config.chains)
    .filter(([, c]) => c.relay === resolved)
    .map(([n]) => n);
  if (orphans.length > 0) {
    console.error(
      `Warning: ${orphans.length} chain(s) reference "${resolved}" as their relay: ${orphans.join(", ")}`,
    );
  }

  delete config.chains[resolved];

  if (config.defaultChain === resolved) {
    config.defaultChain = "polkadot";
    if (!isJsonOutput(opts)) console.log(`Default chain reset to "polkadot".`);
  }

  await saveConfig(config);
  await removeChainData(resolved);

  if (isJsonOutput(opts)) {
    console.log(formatJson({ action: "removed", chain: resolved }));
  } else {
    console.log(`Chain "${resolved}" removed.`);
  }
}

async function chainList(opts: { output?: string; json?: boolean } = {}) {
  const config = await loadConfig();

  if (isJsonOutput(opts)) {
    const chains = Object.entries(config.chains).map(([name, chainConfig]) => ({
      name,
      default: name === config.defaultChain,
      rpc: Array.isArray(chainConfig.rpc) ? chainConfig.rpc : [chainConfig.rpc],
      ...(chainConfig.relay && { relay: chainConfig.relay }),
      ...(chainConfig.parachainId != null && { parachainId: chainConfig.parachainId }),
    }));
    console.log(formatJson({ chains }));
    return;
  }

  printHeading("Configured Chains");

  const parachainsByRelay = new Map<string, [string, ChainConfig][]>();
  const standalone: [string, ChainConfig][] = [];

  for (const [name, chainConfig] of Object.entries(config.chains)) {
    if (chainConfig.relay) {
      const paras = parachainsByRelay.get(chainConfig.relay) ?? [];
      paras.push([name, chainConfig]);
      parachainsByRelay.set(chainConfig.relay, paras);
    }
  }

  const relayNames = new Set(parachainsByRelay.keys());

  for (const [name, chainConfig] of Object.entries(config.chains)) {
    if (relayNames.has(name)) continue;
    if (chainConfig.relay) continue;
    standalone.push([name, chainConfig]);
  }

  for (const relayName of relayNames) {
    const relayConfig = config.chains[relayName];
    if (relayConfig) {
      printChainLine("  ", relayName, relayConfig, config.defaultChain);
    }

    const paras = parachainsByRelay.get(relayName) ?? [];
    for (let i = 0; i < paras.length; i++) {
      const [name, chainConfig] = paras[i]!;
      const isLast = i === paras.length - 1;
      const prefix = isLast ? "  └─ " : "  ├─ ";
      const idSuffix =
        chainConfig.parachainId != null ? ` ${DIM}[${chainConfig.parachainId}]${RESET}` : "";
      printChainLine(prefix, name, chainConfig, config.defaultChain, idSuffix);
    }
    console.log();
  }

  for (const [name, chainConfig] of standalone) {
    printChainLine("  ", name, chainConfig, config.defaultChain);
  }
  if (standalone.length > 0) console.log();
}

function printChainLine(
  prefix: string,
  name: string,
  chainConfig: ChainConfig,
  defaultChain: string,
  suffix = "",
) {
  const isDefault = name === defaultChain;
  const marker = isDefault ? ` ${BOLD}(default)${RESET}` : "";
  const rpcs = Array.isArray(chainConfig.rpc) ? chainConfig.rpc : [chainConfig.rpc];
  console.log(`${prefix}${CYAN}${name}${RESET}${suffix}${marker}  ${DIM}${rpcs[0]}${RESET}`);
  const indent = prefix.replace(/[^\s]/g, " ");
  for (let i = 1; i < rpcs.length; i++) {
    console.log(`${indent}  ${DIM}${rpcs[i]}${RESET}`);
  }
}

async function chainUpdate(
  name: string | undefined,
  opts: { rpc?: string | string[]; all?: boolean; output?: string; json?: boolean },
) {
  const config = await loadConfig();

  if (opts.all) {
    await chainUpdateAll(config);
    return;
  }

  const { name: chainName, chain: chainConfig } = resolveChain(config, name);

  process.stderr.write(`Connecting to ${chainName}...\n`);
  const clientHandle = await createChainClient(chainName, chainConfig, opts.rpc);

  try {
    process.stderr.write("Fetching metadata...\n");
    await fetchMetadataFromChain(clientHandle, chainName);
    if (isJsonOutput(opts)) {
      console.log(formatJson({ action: "updated", chain: chainName }));
    } else {
      console.log(`Metadata for "${chainName}" updated.`);
    }
  } finally {
    clientHandle.destroy();
  }
}

async function chainUpdateAll(config: {
  chains: Record<string, import("../config/types.ts").ChainConfig>;
}) {
  const chainNames = Object.keys(config.chains).sort();

  process.stderr.write(`Updating metadata for ${chainNames.length} chains...\n\n`);

  const results = await Promise.allSettled(
    chainNames.map(async (chainName) => {
      const chainConfig = config.chains[chainName]!;
      const clientHandle = await createChainClient(chainName, chainConfig);
      try {
        await fetchMetadataFromChain(clientHandle, chainName);
      } finally {
        clientHandle.destroy();
      }
    }),
  );

  for (let i = 0; i < chainNames.length; i++) {
    const result = results[i]!;
    const name = chainNames[i]!;
    if (result.status === "fulfilled") {
      console.log(`  ${GREEN}${CHECK_MARK}${RESET} ${name}`);
    } else {
      console.log(
        `  ${RED}✗${RESET} ${name}${DIM} — ${result.reason?.message ?? "unknown error"}${RESET}`,
      );
    }
  }

  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) {
    console.error(`\n${failed} of ${chainNames.length} chains failed to update.`);
    process.exit(1);
  }
}

async function chainDefault(
  name: string | undefined,
  opts: { output?: string; json?: boolean } = {},
) {
  if (!name) {
    console.error("Usage: dot chain default <name>");
    process.exit(1);
  }

  const config = await loadConfig();

  const resolved = findChainName(config, name);
  if (!resolved) {
    const available = Object.keys(config.chains).join(", ");
    throw new Error(`Chain "${name}" not found. Available: ${available}`);
  }

  config.defaultChain = resolved;
  await saveConfig(config);

  if (isJsonOutput(opts)) {
    console.log(formatJson({ action: "default", chain: resolved }));
  } else {
    console.log(`Default chain set to "${resolved}".`);
  }
}

function isBuiltinModified(name: string, config: Config): boolean {
  const defaultRpc = DEFAULT_CONFIG.chains[name]?.rpc;
  const currentRpc = config.chains[name]?.rpc;
  if (!defaultRpc || !currentRpc) return false;
  return JSON.stringify(currentRpc) !== JSON.stringify(defaultRpc);
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

interface ChainExportData {
  defaultChain: string;
  chains: Record<string, ChainConfig>;
}

async function chainExport(
  names: string[],
  opts: {
    all?: boolean;
    file?: string;
    output?: string;
    json?: boolean;
  },
) {
  const config = await loadConfig();
  const exportChains: Record<string, ChainConfig> = {};

  if (names.length > 0) {
    for (const input of names) {
      const resolved = findChainName(config, input);
      if (!resolved) {
        throw new Error(`Chain "${input}" not found.`);
      }
      exportChains[resolved] = config.chains[resolved]!;
    }
  } else if (opts.all) {
    Object.assign(exportChains, config.chains);
  } else {
    // Export user-added chains + built-ins with modified RPC
    for (const [name, chainConfig] of Object.entries(config.chains)) {
      if (!BUILTIN_CHAIN_NAMES.has(name) || isBuiltinModified(name, config)) {
        exportChains[name] = chainConfig;
      }
    }
  }

  const exportData: ChainExportData = {
    defaultChain: config.defaultChain,
    chains: exportChains,
  };

  const json = `${JSON.stringify(exportData, null, 2)}\n`;

  if (opts.file) {
    await writeFile(opts.file, json);
    if (isJsonOutput(opts)) {
      console.log(
        formatJson({
          action: "exported",
          file: opts.file,
          count: Object.keys(exportChains).length,
        }),
      );
    } else {
      console.log(`Exported ${Object.keys(exportChains).length} chain(s) to ${opts.file}`);
    }
  } else {
    process.stdout.write(json);
  }
}

async function chainImport(
  filePath: string | undefined,
  opts: {
    file?: string;
    overwrite?: boolean;
    dryRun?: boolean;
    output?: string;
    json?: boolean;
  },
) {
  // Resolve input: positional arg, --file flag, or stdin
  const inputPath = filePath ?? opts.file;
  let raw: string;
  if (inputPath && inputPath !== "-") {
    raw = await readFile(inputPath, "utf-8");
  } else {
    raw = await readStdin();
  }

  let importData: ChainExportData;
  try {
    importData = JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON input.");
  }

  if (!importData.chains || typeof importData.chains !== "object") {
    throw new Error('Invalid import format: missing "chains" object.');
  }

  const config = await loadConfig();
  const added: string[] = [];
  const skipped: string[] = [];
  const overwritten: string[] = [];
  const warnings: string[] = [];

  for (const [name, chainConfig] of Object.entries(importData.chains)) {
    const existing = findChainName(config, name);

    if (existing && !opts.overwrite) {
      skipped.push(existing);
      process.stderr.write(
        `${YELLOW}Skipped "${existing}": already exists (use --overwrite to replace)${RESET}\n`,
      );
      continue;
    }

    // Validate relay reference
    if (chainConfig.relay) {
      const relayInImport = Object.keys(importData.chains).some(
        (n) => n.toLowerCase() === chainConfig.relay!.toLowerCase(),
      );
      const relayInConfig = findChainName(config, chainConfig.relay);
      if (!relayInImport && !relayInConfig) {
        warnings.push(
          `Chain "${name}" references relay "${chainConfig.relay}" which does not exist.`,
        );
        process.stderr.write(
          `${YELLOW}Warning: "${name}" references relay "${chainConfig.relay}" which does not exist.${RESET}\n`,
        );
      }
    }

    if (existing) {
      overwritten.push(existing);
      config.chains[existing] = chainConfig;
    } else {
      added.push(name);
      config.chains[name] = chainConfig;
    }
  }

  // Update defaultChain if present in import and overwrite is set
  let defaultChanged = false;
  if (importData.defaultChain && opts.overwrite) {
    const resolvedDefault = findChainName(config, importData.defaultChain);
    if (resolvedDefault) {
      config.defaultChain = resolvedDefault;
      defaultChanged = true;
    }
  }

  if (!opts.dryRun) {
    await saveConfig(config);
  }

  if (isJsonOutput(opts)) {
    console.log(
      formatJson({
        action: opts.dryRun ? "dry-run" : "imported",
        added,
        overwritten,
        skipped,
        warnings,
        defaultChanged: defaultChanged ? config.defaultChain : undefined,
      }),
    );
    return;
  }

  const prefix = opts.dryRun ? "(dry run) " : "";
  if (added.length > 0) console.log(`${prefix}Added: ${added.join(", ")}`);
  if (overwritten.length > 0) console.log(`${prefix}Overwritten: ${overwritten.join(", ")}`);
  if (skipped.length > 0) console.log(`${prefix}Skipped: ${skipped.join(", ")}`);
  if (defaultChanged) console.log(`${prefix}Default chain set to "${config.defaultChain}".`);

  if (added.length === 0 && overwritten.length === 0) {
    console.log(`${prefix}No chains imported.`);
  } else if (!opts.dryRun) {
    console.error(`\nRun "dot chain update --all" to fetch metadata for imported chains.`);
  }
}
