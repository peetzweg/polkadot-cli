import type { CAC } from "cac";
import {
  findChainName,
  loadConfig,
  removeChainData,
  resolveChain,
  saveConfig,
} from "../config/store.ts";
import { BUILTIN_CHAIN_NAMES, type ChainConfig } from "../config/types.ts";
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
} from "../core/output.ts";

const CHAIN_HELP = `
${BOLD}Usage:${RESET}
  $ dot chain add <name> --rpc <url>    Add a chain via WebSocket RPC
  $ dot chain remove <name>             Remove a chain
  $ dot chain update [name]             Re-fetch metadata (default chain if omitted)
  $ dot chain update --all              Re-fetch metadata for all configured chains
  $ dot chain list                      List configured chains
  $ dot chain default <name>            Set the default chain

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
`.trimStart();

export function registerChainCommands(cli: CAC) {
  cli
    .command("chain [action] [name]", "Manage chains (add, remove, update, list, default)")
    .alias("chains")
    .option("--all", "Update all configured chains")
    .option("--relay <name>", "Parent relay chain for this parachain")
    .option("--parachain-id <id>", "Parachain ID (auto-detected if omitted with --relay)")
    .action(
      async (
        action: string | undefined,
        name: string | undefined,
        opts: {
          rpc?: string | string[];
          all?: boolean;
          relay?: string;
          parachainId?: string;
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
            return chainAdd(name, opts);
          case "remove":
            return chainRemove(name, opts);
          case "list":
            return chainList(opts);
          case "update":
            return chainUpdate(name, opts);
          case "default":
            return chainDefault(name, opts);
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

  console.error(`Connecting to ${name}...`);
  const clientHandle = await createChainClient(name, chainConfig, opts.rpc);

  try {
    console.error("Fetching metadata...");
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
        console.error("Detecting parachain ID...");
        const detected = await getParachainId(clientHandle);
        if (detected != null) {
          chainConfig.parachainId = detected;
          console.error(`Detected parachain ID: ${detected}`);
        } else {
          console.error("Could not detect parachain ID. Use --parachain-id to set it manually.");
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

  console.error(`Connecting to ${chainName}...`);
  const clientHandle = await createChainClient(chainName, chainConfig, opts.rpc);

  try {
    console.error("Fetching metadata...");
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

  console.error(`Updating metadata for ${chainNames.length} chains...\n`);

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
