import type { CAC } from "cac";
import {
  loadConfig,
  saveConfig,
  removeChainData,
} from "../config/store.ts";
import { createChainClient } from "../core/client.ts";
import { fetchMetadataFromChain } from "../core/metadata.ts";
import { printHeading, BOLD, CYAN, RESET, DIM } from "../core/output.ts";

const CHAIN_HELP = `
${BOLD}Usage:${RESET}
  $ dot chain add <name> --rpc <url>    Add a chain via WebSocket RPC
  $ dot chain add <name> --light-client Add a chain via Smoldot light client
  $ dot chain remove <name>             Remove a chain
  $ dot chain list                      List configured chains
  $ dot chain default <name>            Set the default chain

${BOLD}Examples:${RESET}
  $ dot chain add kusama --rpc wss://kusama-rpc.polkadot.io
  $ dot chain add westend --light-client
  $ dot chain default kusama
  $ dot chain list
  $ dot chain remove kusama
`.trimStart();

export function registerChainCommands(cli: CAC) {
  cli
    .command("chain [action] [name]", "Manage chains (add, remove, list, default)")
    .action(
      async (
        action: string | undefined,
        name: string | undefined,
        opts: { rpc?: string; lightClient?: boolean },
      ) => {
        if (!action) {
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
  opts: { rpc?: string; lightClient?: boolean },
) {
  if (!name) {
    console.error("Chain name is required.\n");
    console.error("Usage: dot chain add <name> --rpc <url>");
    console.error("       dot chain add <name> --light-client");
    process.exit(1);
  }
  if (!opts.rpc && !opts.lightClient) {
    console.error("Must provide either --rpc <url> or --light-client.\n");
    console.error("Usage: dot chain add <name> --rpc <url>");
    console.error("       dot chain add <name> --light-client");
    process.exit(1);
  }

  const config = await loadConfig();

  config.chains[name] = {
    rpc: opts.rpc ?? "",
    ...(opts.lightClient ? { lightClient: true } : {}),
  };

  await saveConfig(config);

  console.log(`Connecting to ${name}...`);
  const clientHandle = await createChainClient(name, config.chains[name]!, opts.rpc);

  try {
    console.log("Fetching metadata...");
    await fetchMetadataFromChain(clientHandle, name);
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

  if (!config.chains[name]) {
    throw new Error(`Chain "${name}" not found.`);
  }

  if (name === "polkadot") {
    throw new Error('Cannot remove the built-in "polkadot" chain.');
  }

  delete config.chains[name];

  if (config.defaultChain === name) {
    config.defaultChain = "polkadot";
    console.log(`Default chain reset to "polkadot".`);
  }

  await saveConfig(config);
  await removeChainData(name);
  console.log(`Chain "${name}" removed.`);
}

async function chainList() {
  const config = await loadConfig();
  printHeading("Configured Chains");

  for (const [name, chainConfig] of Object.entries(config.chains)) {
    const isDefault = name === config.defaultChain;
    const marker = isDefault ? ` ${BOLD}(default)${RESET}` : "";
    const provider = chainConfig.lightClient
      ? `${DIM}light-client${RESET}`
      : `${DIM}${chainConfig.rpc}${RESET}`;
    console.log(`  ${CYAN}${name}${RESET}${marker}  ${provider}`);
  }
  console.log();
}

async function chainDefault(name: string | undefined) {
  if (!name) {
    console.error("Usage: dot chain default <name>");
    process.exit(1);
  }

  const config = await loadConfig();

  if (!config.chains[name]) {
    const available = Object.keys(config.chains).join(", ");
    throw new Error(`Chain "${name}" not found. Available: ${available}`);
  }

  config.defaultChain = name;
  await saveConfig(config);
  console.log(`Default chain set to "${name}".`);
}
