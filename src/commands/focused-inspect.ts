import type { CAC } from "cac";
import { loadConfig, resolveChain } from "../config/store.ts";
import { createChainClient } from "../core/client.ts";
import type { MetadataBundle, PalletInfo } from "../core/metadata.ts";
import {
  describeCallArgs,
  describeEventFields,
  describeType,
  findPallet,
  getOrFetchMetadata,
  getPalletNames,
  listPallets,
} from "../core/metadata.ts";
import {
  BOLD,
  CYAN,
  DIM,
  printDocs,
  printHeading,
  printItem,
  RESET,
  truncate,
} from "../core/output.ts";
import { suggestMessage } from "../utils/fuzzy-match.ts";
import { parseTarget, resolveTargetChain } from "../utils/parse-target.ts";

async function loadMeta(
  chainName: string,
  chainConfig: any,
  rpcOverride?: string,
): Promise<MetadataBundle> {
  try {
    return await getOrFetchMetadata(chainName);
  } catch {
    console.error(`Fetching metadata from ${chainName}...`);
    const clientHandle = await createChainClient(chainName, chainConfig, rpcOverride);
    try {
      return await getOrFetchMetadata(chainName, clientHandle);
    } finally {
      clientHandle.destroy();
    }
  }
}

function resolvePallet(meta: MetadataBundle, palletName: string): PalletInfo {
  const palletNames = getPalletNames(meta);
  const pallet = findPallet(meta, palletName);
  if (!pallet) {
    throw new Error(suggestMessage("pallet", palletName, palletNames));
  }
  return pallet;
}

export function registerFocusedInspectCommands(cli: CAC) {
  // --- calls / call ---
  cli
    .command("call [target]", "List or inspect pallet calls")
    .alias("calls")
    .option("--chain <name>", "Target chain")
    .option("--rpc <url>", "Override RPC endpoint")
    .action(async (target: string | undefined, opts: { chain?: string; rpc?: string }) => {
      if (!target) {
        console.log("Usage: dot calls <[Chain.]Pallet[.Call]> [--chain <name>]");
        console.log("");
        console.log("Examples:");
        console.log("  $ dot calls Balances");
        console.log("  $ dot calls Balances.transfer_allow_death");
        return;
      }

      const config = await loadConfig();
      const knownChains = Object.keys(config.chains);
      const parsed = parseTarget(target, { knownChains, allowPalletOnly: true });
      const effectiveChain = resolveTargetChain(parsed, opts.chain);
      const { name: chainName, chain: chainConfig } = resolveChain(config, effectiveChain);
      const meta = await loadMeta(chainName, chainConfig, opts.rpc);
      const pallet = resolvePallet(meta, parsed.pallet);

      if (!parsed.item) {
        // List calls
        if (pallet.calls.length === 0) {
          console.log(`No calls in ${pallet.name}.`);
          return;
        }
        printHeading(`${pallet.name} Calls`);
        for (const c of pallet.calls) {
          const args = describeCallArgs(meta, pallet.name, c.name);
          console.log(`  ${CYAN}${c.name}${RESET}${DIM}${args}${RESET}`);
          if (c.docs[0]) {
            console.log(`      ${DIM}${c.docs[0].slice(0, 80)}${RESET}`);
          }
        }
        console.log();
        return;
      }

      // Call detail
      const callItem = pallet.calls.find(
        (c) => c.name.toLowerCase() === parsed.item!.toLowerCase(),
      );
      if (!callItem) {
        const names = pallet.calls.map((c) => c.name);
        throw new Error(suggestMessage(`call in ${pallet.name}`, parsed.item, names));
      }

      printHeading(`${pallet.name}.${callItem.name} (Call)`);
      const args = describeCallArgs(meta, pallet.name, callItem.name);
      console.log(`  ${BOLD}Args:${RESET} ${args}`);
      if (callItem.docs.length) {
        console.log();
        printDocs(callItem.docs);
      }
      console.log();
    });

  // --- events / event ---
  cli
    .command("event [target]", "List or inspect pallet events")
    .alias("events")
    .option("--chain <name>", "Target chain")
    .option("--rpc <url>", "Override RPC endpoint")
    .action(async (target: string | undefined, opts: { chain?: string; rpc?: string }) => {
      if (!target) {
        console.log("Usage: dot events <[Chain.]Pallet[.Event]> [--chain <name>]");
        console.log("");
        console.log("Examples:");
        console.log("  $ dot events Balances");
        console.log("  $ dot events Balances.Transfer");
        return;
      }

      const config = await loadConfig();
      const knownChains = Object.keys(config.chains);
      const parsed = parseTarget(target, { knownChains, allowPalletOnly: true });
      const effectiveChain = resolveTargetChain(parsed, opts.chain);
      const { name: chainName, chain: chainConfig } = resolveChain(config, effectiveChain);
      const meta = await loadMeta(chainName, chainConfig, opts.rpc);
      const pallet = resolvePallet(meta, parsed.pallet);

      if (!parsed.item) {
        // List events
        if (pallet.events.length === 0) {
          console.log(`No events in ${pallet.name}.`);
          return;
        }
        printHeading(`${pallet.name} Events`);
        for (const e of pallet.events) {
          const fields = describeEventFields(meta, pallet.name, e.name);
          console.log(`  ${CYAN}${e.name}${RESET}${DIM}${fields}${RESET}`);
          if (e.docs[0]) {
            console.log(`      ${DIM}${e.docs[0].slice(0, 80)}${RESET}`);
          }
        }
        console.log();
        return;
      }

      // Event detail
      const eventItem = pallet.events.find(
        (e) => e.name.toLowerCase() === parsed.item!.toLowerCase(),
      );
      if (!eventItem) {
        const names = pallet.events.map((e) => e.name);
        throw new Error(suggestMessage(`event in ${pallet.name}`, parsed.item, names));
      }

      printHeading(`${pallet.name}.${eventItem.name} (Event)`);
      const fields = describeEventFields(meta, pallet.name, eventItem.name);
      console.log(`  ${BOLD}Fields:${RESET} ${fields}`);
      if (eventItem.docs.length) {
        console.log();
        printDocs(eventItem.docs);
      }
      console.log();
    });

  // --- errors / error ---
  cli
    .command("error [target]", "List or inspect pallet errors")
    .alias("errors")
    .option("--chain <name>", "Target chain")
    .option("--rpc <url>", "Override RPC endpoint")
    .action(async (target: string | undefined, opts: { chain?: string; rpc?: string }) => {
      if (!target) {
        console.log("Usage: dot errors <[Chain.]Pallet[.Error]> [--chain <name>]");
        console.log("");
        console.log("Examples:");
        console.log("  $ dot errors Balances");
        console.log("  $ dot errors Balances.InsufficientBalance");
        return;
      }

      const config = await loadConfig();
      const knownChains = Object.keys(config.chains);
      const parsed = parseTarget(target, { knownChains, allowPalletOnly: true });
      const effectiveChain = resolveTargetChain(parsed, opts.chain);
      const { name: chainName, chain: chainConfig } = resolveChain(config, effectiveChain);
      const meta = await loadMeta(chainName, chainConfig, opts.rpc);
      const pallet = resolvePallet(meta, parsed.pallet);

      if (!parsed.item) {
        // List errors
        if (pallet.errors.length === 0) {
          console.log(`No errors in ${pallet.name}.`);
          return;
        }
        printHeading(`${pallet.name} Errors`);
        for (const e of pallet.errors) {
          console.log(`  ${CYAN}${e.name}${RESET}`);
          if (e.docs[0]) {
            console.log(`      ${DIM}${e.docs[0].slice(0, 80)}${RESET}`);
          }
        }
        console.log();
        return;
      }

      // Error detail
      const errorItem = pallet.errors.find(
        (e) => e.name.toLowerCase() === parsed.item!.toLowerCase(),
      );
      if (!errorItem) {
        const names = pallet.errors.map((e) => e.name);
        throw new Error(suggestMessage(`error in ${pallet.name}`, parsed.item, names));
      }

      printHeading(`${pallet.name}.${errorItem.name} (Error)`);
      if (errorItem.docs.length) {
        printDocs(errorItem.docs);
      }
      console.log();
    });

  // --- storage ---
  cli
    .command("storage [target]", "List or inspect pallet storage items")
    .option("--chain <name>", "Target chain")
    .option("--rpc <url>", "Override RPC endpoint")
    .action(async (target: string | undefined, opts: { chain?: string; rpc?: string }) => {
      if (!target) {
        console.log("Usage: dot storage <[Chain.]Pallet[.Item]> [--chain <name>]");
        console.log("");
        console.log("Examples:");
        console.log("  $ dot storage System");
        console.log("  $ dot storage System.Account");
        return;
      }

      const config = await loadConfig();
      const knownChains = Object.keys(config.chains);
      const parsed = parseTarget(target, { knownChains, allowPalletOnly: true });
      const effectiveChain = resolveTargetChain(parsed, opts.chain);
      const { name: chainName, chain: chainConfig } = resolveChain(config, effectiveChain);
      const meta = await loadMeta(chainName, chainConfig, opts.rpc);
      const pallet = resolvePallet(meta, parsed.pallet);

      if (!parsed.item) {
        // List storage items
        if (pallet.storage.length === 0) {
          console.log(`No storage items in ${pallet.name}.`);
          return;
        }
        printHeading(`${pallet.name} Storage`);
        for (const s of pallet.storage) {
          const valueType = truncate(describeType(meta.lookup, s.valueTypeId), 60);
          let typeSuffix: string;
          if (s.keyTypeId != null) {
            const keyType = truncate(describeType(meta.lookup, s.keyTypeId), 60);
            typeSuffix = `: ${keyType} → ${valueType}    [map]`;
          } else {
            typeSuffix = `: ${valueType}`;
          }
          console.log(`  ${CYAN}${s.name}${RESET}${DIM}${typeSuffix}${RESET}`);
          if (s.docs[0]) {
            console.log(`      ${DIM}${s.docs[0].slice(0, 80)}${RESET}`);
          }
        }
        console.log();
        return;
      }

      // Storage detail
      const storageItem = pallet.storage.find(
        (s) => s.name.toLowerCase() === parsed.item!.toLowerCase(),
      );
      if (!storageItem) {
        const names = pallet.storage.map((s) => s.name);
        throw new Error(suggestMessage(`storage item in ${pallet.name}`, parsed.item, names));
      }

      printHeading(`${pallet.name}.${storageItem.name} (Storage)`);
      console.log(`  ${BOLD}Type:${RESET} ${storageItem.type}`);
      console.log(`  ${BOLD}Value:${RESET} ${describeType(meta.lookup, storageItem.valueTypeId)}`);
      if (storageItem.keyTypeId != null) {
        console.log(`  ${BOLD}Key:${RESET} ${describeType(meta.lookup, storageItem.keyTypeId)}`);
      }
      if (storageItem.docs.length) {
        console.log();
        printDocs(storageItem.docs);
      }
      console.log();
    });

  // --- pallets / pallet ---
  cli
    .command("pallet [target]", "List all pallets or inspect a specific pallet")
    .alias("pallets")
    .option("--chain <name>", "Target chain")
    .option("--rpc <url>", "Override RPC endpoint")
    .action(async (target: string | undefined, opts: { chain?: string; rpc?: string }) => {
      const config = await loadConfig();
      const knownChains = Object.keys(config.chains);

      let effectiveChain: string | undefined = opts.chain;
      let palletName: string | undefined;

      if (target) {
        const parsed = parseTarget(target, { knownChains, allowPalletOnly: true });
        effectiveChain = resolveTargetChain(parsed, opts.chain);
        palletName = parsed.pallet;
      }

      const { name: chainName, chain: chainConfig } = resolveChain(config, effectiveChain);
      const meta = await loadMeta(chainName, chainConfig, opts.rpc);

      if (!palletName) {
        // List all pallets
        const pallets = listPallets(meta);
        printHeading(`Pallets on ${chainName} (${pallets.length})`);
        for (const p of pallets) {
          const counts = [];
          if (p.storage.length) counts.push(`${p.storage.length} storage`);
          if (p.constants.length) counts.push(`${p.constants.length} constants`);
          if (p.calls.length) counts.push(`${p.calls.length} calls`);
          if (p.events.length) counts.push(`${p.events.length} events`);
          if (p.errors.length) counts.push(`${p.errors.length} errors`);
          printItem(p.name, counts.join(", "));
        }
        console.log();
        return;
      }

      // Specific pallet — same as inspect pallet view
      const pallet = resolvePallet(meta, palletName);
      printHeading(`${pallet.name} Pallet`);

      if (pallet.docs.length) {
        printDocs(pallet.docs);
        console.log();
      }

      const counts = [];
      if (pallet.storage.length) counts.push(`${pallet.storage.length} storage`);
      if (pallet.constants.length) counts.push(`${pallet.constants.length} constants`);
      if (pallet.calls.length) counts.push(`${pallet.calls.length} calls`);
      if (pallet.events.length) counts.push(`${pallet.events.length} events`);
      if (pallet.errors.length) counts.push(`${pallet.errors.length} errors`);
      if (counts.length) {
        console.log(`  ${counts.join(", ")}`);
      }
      console.log();
    });
}
