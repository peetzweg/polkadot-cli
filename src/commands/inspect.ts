import type { CAC } from "cac";
import { loadConfig, resolveChain } from "../config/store.ts";
import { createChainClient } from "../core/client.ts";
import {
  getOrFetchMetadata,
  listPallets,
  findPallet,
  getPalletNames,
  describeType,
} from "../core/metadata.ts";
import {
  printHeading,
  printItem,
  printDocs,
  BOLD,
  CYAN,
  DIM,
  RESET,
  YELLOW,
} from "../core/output.ts";
import { parseTarget } from "../utils/parse-target.ts";
import { suggestMessage } from "../utils/fuzzy-match.ts";

export function registerInspectCommand(cli: CAC) {
  cli
    .command("inspect [target]", "Inspect chain metadata (pallets, storage, constants)")
    .option("--chain <name>", "Target chain")
    .option("--rpc <url>", "Override RPC endpoint")
    .action(async (target: string | undefined, opts: { chain?: string; rpc?: string }) => {
      const config = await loadConfig();
      const { name: chainName, chain: chainConfig } = resolveChain(config, opts.chain);

      // Try loading cached metadata first; if unavailable, connect and fetch
      let meta;
      try {
        meta = await getOrFetchMetadata(chainName);
      } catch {
        console.log(`Fetching metadata from ${chainName}...`);
        const clientHandle = await createChainClient(chainName, chainConfig, opts.rpc);
        try {
          meta = await getOrFetchMetadata(chainName, clientHandle);
        } finally {
          clientHandle.destroy();
        }
      }

      if (!target) {
        // List all pallets
        const pallets = listPallets(meta);
        printHeading(`Pallets on ${chainName} (${pallets.length})`);
        for (const p of pallets) {
          const counts = [];
          if (p.storage.length) counts.push(`${p.storage.length} storage`);
          if (p.constants.length) counts.push(`${p.constants.length} constants`);
          printItem(p.name, counts.join(", "));
        }
        console.log();
        return;
      }

      // Check if target is "Pallet" or "Pallet.Item"
      if (!target.includes(".")) {
        // List pallet items
        const palletNames = getPalletNames(meta);
        const pallet = findPallet(meta, target);
        if (!pallet) {
          throw new Error(suggestMessage("pallet", target, palletNames));
        }

        printHeading(`${pallet.name} Pallet`);

        if (pallet.docs.length) {
          printDocs(pallet.docs);
          console.log();
        }

        if (pallet.storage.length) {
          console.log(`  ${BOLD}Storage Items:${RESET}`);
          for (const s of pallet.storage) {
            const doc = s.docs[0] ? ` — ${s.docs[0].slice(0, 80)}` : "";
            console.log(`    ${CYAN}${s.name}${RESET}${DIM}${doc}${RESET}`);
          }
          console.log();
        }

        if (pallet.constants.length) {
          console.log(`  ${BOLD}Constants:${RESET}`);
          for (const c of pallet.constants) {
            const doc = c.docs[0] ? ` — ${c.docs[0].slice(0, 80)}` : "";
            console.log(`    ${CYAN}${c.name}${RESET}${DIM}${doc}${RESET}`);
          }
          console.log();
        }
        return;
      }

      // Specific item detail
      const { pallet: palletName, item: itemName } = parseTarget(target);

      const palletNames = getPalletNames(meta);
      const pallet = findPallet(meta, palletName);
      if (!pallet) {
        throw new Error(suggestMessage("pallet", palletName, palletNames));
      }

      // Search in storage
      const storageItem = pallet.storage.find(
        (s) => s.name.toLowerCase() === itemName.toLowerCase(),
      );
      if (storageItem) {
        printHeading(`${pallet.name}.${storageItem.name} (Storage)`);
        console.log(`  ${BOLD}Type:${RESET} ${storageItem.type}`);
        console.log(
          `  ${BOLD}Value:${RESET} ${describeType(meta.lookup, storageItem.valueTypeId)}`,
        );
        if (storageItem.keyTypeId != null) {
          console.log(
            `  ${BOLD}Key:${RESET} ${describeType(meta.lookup, storageItem.keyTypeId)}`,
          );
        }
        if (storageItem.docs.length) {
          console.log();
          printDocs(storageItem.docs);
        }
        console.log();
        return;
      }

      // Search in constants
      const constantItem = pallet.constants.find(
        (c) => c.name.toLowerCase() === itemName.toLowerCase(),
      );
      if (constantItem) {
        printHeading(`${pallet.name}.${constantItem.name} (Constant)`);
        console.log(
          `  ${BOLD}Type:${RESET} ${describeType(meta.lookup, constantItem.typeId)}`,
        );
        if (constantItem.docs.length) {
          console.log();
          printDocs(constantItem.docs);
        }
        console.log();
        return;
      }

      // Not found — suggest
      const allItems = [
        ...pallet.storage.map((s) => s.name),
        ...pallet.constants.map((c) => c.name),
      ];
      throw new Error(
        suggestMessage(`item in ${pallet.name}`, itemName, allItems),
      );
    });
}
