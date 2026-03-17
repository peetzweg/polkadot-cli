import type { CAC } from "cac";
import {
  findChainName,
  loadConfig,
  removeChainData,
  resolveChain,
  saveConfig,
} from "../config/store.ts";
import { BUILTIN_CHAIN_NAMES } from "../config/types.ts";
import { createChainClient, hasLightClientSpec } from "../core/client.ts";
import { fetchMetadataFromChain } from "../core/metadata.ts";
import { BOLD, CYAN, DIM, printHeading, RESET } from "../core/output.ts";

const CHAIN_HELP = `
${BOLD}Usage:${RESET}
  $ dot chain add <name>                Add a known chain (uses light client automatically)
  $ dot chain add <name> --rpc <url>    Add a chain via WebSocket RPC
  $ dot chain remove <name>             Remove a chain
  $ dot chain update [name]             Re-fetch metadata (default chain if omitted)
  $ dot chain list                      List configured chains
  $ dot chain default <name>            Set the default chain

${BOLD}Examples:${RESET}
  $ dot chain add kusama
  $ dot chain add kusama --rpc wss://kusama-rpc.polkadot.io
  $ dot chain add kusama --rpc wss://kusama-rpc.polkadot.io --rpc wss://kusama-rpc.dwellir.com
  $ dot chain default kusama
  $ dot chain list
  $ dot chain update
  $ dot chain update kusama
  $ dot chain remove kusama
`.trimStart();

export function registerChainCommands(cli: CAC) {
  cli
    .command("chain [action] [name]", "Manage chains (add, remove, update, list, default)")
    .alias("chains")
    .action(
      async (
        action: string | undefined,
        name: string | undefined,
        opts: { rpc?: string | string[] },
      ) => {
        if (!action) {
          if (process.argv[2] === "chains") return chainList();
          console.log(CHAIN_HELP);
          return;
        }
        switch (action) {
          case "add":
            return chainAdd(name, opts);
          case "remove":
            return chainRemove(name);
          case "list":
            return chainList();
          case "update":
            return chainUpdate(name, opts);
          case "default":
            return chainDefault(name);
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
  opts: { rpc?: string | string[] },
) {
  if (!name) {
    console.error("Chain name is required.\n");
    console.error("Usage: dot chain add <name> --rpc <url>");
    process.exit(1);
  }
  if (!opts.rpc && !hasLightClientSpec(name)) {
    console.error(
      `Chain "${name}" has no built-in light client support. Use --rpc <url>.\n`,
    );
    console.error("Usage: dot chain add <name> --rpc <url>");
    process.exit(1);
  }

  const chainConfig = {
    rpc: opts.rpc ?? [],
  };

  console.error(`Connecting to ${name}...`);
  const clientHandle = await createChainClient(name, chainConfig, opts.rpc);

  try {
    console.error("Fetching metadata...");
    await fetchMetadataFromChain(clientHandle, name);

    // Only save config after successful connection + metadata fetch
    const config = await loadConfig();
    config.chains[name] = chainConfig;
    await saveConfig(config);

    console.log(`Chain "${name}" added successfully.`);
  } finally {
    clientHandle.destroy();
  }
}

async function chainRemove(name: string | undefined) {
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

  delete config.chains[resolved];

  if (config.defaultChain === resolved) {
    config.defaultChain = "polkadot";
    console.log(`Default chain reset to "polkadot".`);
  }

  await saveConfig(config);
  await removeChainData(resolved);
  console.log(`Chain "${resolved}" removed.`);
}

async function chainList() {
  const config = await loadConfig();
  printHeading("Configured Chains");

  for (const [name, chainConfig] of Object.entries(config.chains)) {
    const isDefault = name === config.defaultChain;
    const marker = isDefault ? ` ${BOLD}(default)${RESET}` : "";
    const lcBadge = hasLightClientSpec(name) ? ` ${DIM}[light-client]${RESET}` : "";
    const rpcs = Array.isArray(chainConfig.rpc) ? chainConfig.rpc : [chainConfig.rpc];
    const hasRpcs = rpcs.length > 0 && rpcs[0] !== "";
    if (hasRpcs) {
      console.log(`  ${CYAN}${name}${RESET}${marker}${lcBadge}  ${DIM}${rpcs[0]}${RESET}`);
      for (let i = 1; i < rpcs.length; i++) {
        console.log(`    ${DIM}${rpcs[i]}${RESET}`);
      }
    } else {
      console.log(`  ${CYAN}${name}${RESET}${marker}${lcBadge}`);
    }
  }
  console.log();
}

async function chainUpdate(name: string | undefined, opts: { rpc?: string | string[] }) {
  const config = await loadConfig();
  const { name: chainName, chain: chainConfig } = resolveChain(config, name);

  console.error(`Connecting to ${chainName}...`);
  const clientHandle = await createChainClient(chainName, chainConfig, opts.rpc);

  try {
    console.error("Fetching metadata...");
    await fetchMetadataFromChain(clientHandle, chainName);
    console.log(`Metadata for "${chainName}" updated.`);
  } finally {
    clientHandle.destroy();
  }
}

async function chainDefault(name: string | undefined) {
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
  console.log(`Default chain set to "${resolved}".`);
}
