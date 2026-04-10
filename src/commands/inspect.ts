import type { CAC } from "cac";
import { loadConfig, resolveChain } from "../config/store.ts";
import { createChainClient } from "../core/client.ts";
import type { MetadataBundle } from "../core/metadata.ts";
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
  firstSentence,
  formatJson,
  isJsonOutput,
  printDocs,
  printHeading,
  printItem,
  RESET,
} from "../core/output.ts";
import { suggestMessage } from "../utils/fuzzy-match.ts";
import { parseTarget, resolveTargetChain } from "../utils/parse-target.ts";

export function registerInspectCommand(cli: CAC) {
  cli
    .command(
      "inspect [target]",
      "Inspect chain metadata (pallets, storage, constants, calls, events, errors)",
    )
    .alias("explore")
    .option("--chain <name>", "Target chain")
    .option("--rpc <url>", "Override RPC endpoint")
    .action(
      async (
        target: string | undefined,
        opts: { chain?: string; rpc?: string; output?: string; json?: boolean },
      ) => {
        const config = await loadConfig();
        const knownChains = Object.keys(config.chains);

        let effectiveChain: string | undefined = opts.chain;
        let palletName: string | undefined;
        let itemName: string | undefined;

        if (target) {
          const parsed = parseTarget(target, { knownChains, allowPalletOnly: true });
          effectiveChain = resolveTargetChain(parsed, opts.chain);
          palletName = parsed.pallet;
          itemName = parsed.item;
        }

        const { name: chainName, chain: chainConfig } = resolveChain(config, effectiveChain);

        // Try loading cached metadata first; if unavailable, connect and fetch
        let meta: MetadataBundle;
        try {
          meta = await getOrFetchMetadata(chainName);
        } catch {
          console.error(`Fetching metadata from ${chainName}...`);
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

          if (isJsonOutput(opts)) {
            console.log(
              formatJson({
                chain: chainName,
                pallets: pallets.map((p) => ({
                  name: p.name,
                  storage: p.storage.length,
                  constants: p.constants.length,
                  calls: p.calls.length,
                  events: p.events.length,
                  errors: p.errors.length,
                })),
              }),
            );
            return;
          }

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

        if (!itemName) {
          // List pallet items
          const palletNames = getPalletNames(meta);
          const pallet = findPallet(meta, palletName!);
          if (!pallet) {
            throw new Error(suggestMessage("pallet", palletName!, palletNames));
          }

          if (isJsonOutput(opts)) {
            console.log(
              formatJson({
                chain: chainName,
                pallet: pallet.name,
                docs: pallet.docs,
                storage: pallet.storage.map((s) => {
                  const valueType = describeType(meta.lookup, s.valueTypeId);
                  const keyType =
                    s.keyTypeId != null ? describeType(meta.lookup, s.keyTypeId) : undefined;
                  return {
                    name: s.name,
                    type: s.type,
                    valueType,
                    keyType,
                    docs: firstSentence(s.docs),
                  };
                }),
                constants: pallet.constants.map((c) => ({
                  name: c.name,
                  type: describeType(meta.lookup, c.typeId),
                  docs: firstSentence(c.docs),
                })),
                calls: pallet.calls.map((c) => ({
                  name: c.name,
                  args: describeCallArgs(meta, pallet.name, c.name),
                  docs: firstSentence(c.docs),
                })),
                events: pallet.events.map((e) => ({
                  name: e.name,
                  fields: describeEventFields(meta, pallet.name, e.name),
                  docs: firstSentence(e.docs),
                })),
                errors: pallet.errors.map((e) => ({
                  name: e.name,
                  docs: firstSentence(e.docs),
                })),
              }),
            );
            return;
          }

          printHeading(`${pallet.name} Pallet`);

          if (pallet.docs.length) {
            printDocs(pallet.docs);
            console.log();
          }

          if (pallet.storage.length) {
            console.log(`  ${BOLD}Storage Items:${RESET}`);
            for (const s of pallet.storage) {
              const valueType = describeType(meta.lookup, s.valueTypeId);
              let typeSuffix: string;
              if (s.keyTypeId != null) {
                const keyType = describeType(meta.lookup, s.keyTypeId);
                typeSuffix = `: ${keyType} → ${valueType}    [map]`;
              } else {
                typeSuffix = `: ${valueType}`;
              }
              console.log(`    ${CYAN}${s.name}${RESET}${DIM}${typeSuffix}${RESET}`);
              const summary = firstSentence(s.docs);
              if (summary) {
                console.log(`        ${DIM}${summary}${RESET}`);
              }
            }
            console.log();
          }

          if (pallet.constants.length) {
            console.log(`  ${BOLD}Constants:${RESET}`);
            for (const c of pallet.constants) {
              const typeStr = describeType(meta.lookup, c.typeId);
              console.log(`    ${CYAN}${c.name}${RESET}${DIM}: ${typeStr}${RESET}`);
              const summary = firstSentence(c.docs);
              if (summary) {
                console.log(`        ${DIM}${summary}${RESET}`);
              }
            }
            console.log();
          }

          if (pallet.calls.length) {
            console.log(`  ${BOLD}Calls:${RESET}`);
            for (const c of pallet.calls) {
              const args = describeCallArgs(meta, pallet.name, c.name);
              console.log(`    ${CYAN}${c.name}${RESET}${DIM}${args}${RESET}`);
              const summary = firstSentence(c.docs);
              if (summary) {
                console.log(`        ${DIM}${summary}${RESET}`);
              }
            }
            console.log();
          }

          if (pallet.events.length) {
            console.log(`  ${BOLD}Events:${RESET}`);
            for (const e of pallet.events) {
              const fields = describeEventFields(meta, pallet.name, e.name);
              console.log(`    ${CYAN}${e.name}${RESET}${DIM}${fields}${RESET}`);
              const summary = firstSentence(e.docs);
              if (summary) {
                console.log(`        ${DIM}${summary}${RESET}`);
              }
            }
            console.log();
          }

          if (pallet.errors.length) {
            console.log(`  ${BOLD}Errors:${RESET}`);
            for (const e of pallet.errors) {
              console.log(`    ${CYAN}${e.name}${RESET}`);
              const summary = firstSentence(e.docs);
              if (summary) {
                console.log(`        ${DIM}${summary}${RESET}`);
              }
            }
            console.log();
          }
          return;
        }

        // Specific item detail
        const palletNames = getPalletNames(meta);
        const pallet = findPallet(meta, palletName!);
        if (!pallet) {
          throw new Error(suggestMessage("pallet", palletName!, palletNames));
        }

        if (isJsonOutput(opts)) {
          // Find item across all categories and emit JSON
          const si = pallet.storage.find((s) => s.name.toLowerCase() === itemName.toLowerCase());
          if (si) {
            const valueType = describeType(meta.lookup, si.valueTypeId);
            const keyType =
              si.keyTypeId != null ? describeType(meta.lookup, si.keyTypeId) : undefined;
            console.log(
              formatJson({
                chain: chainName,
                pallet: pallet.name,
                item: si.name,
                category: "storage",
                type: si.type,
                valueType,
                keyType,
                docs: si.docs,
              }),
            );
            return;
          }
          const ci = pallet.constants.find((c) => c.name.toLowerCase() === itemName.toLowerCase());
          if (ci) {
            console.log(
              formatJson({
                chain: chainName,
                pallet: pallet.name,
                item: ci.name,
                category: "constant",
                type: describeType(meta.lookup, ci.typeId),
                docs: ci.docs,
              }),
            );
            return;
          }
          const ca = pallet.calls.find((c) => c.name.toLowerCase() === itemName.toLowerCase());
          if (ca) {
            console.log(
              formatJson({
                chain: chainName,
                pallet: pallet.name,
                item: ca.name,
                category: "call",
                args: describeCallArgs(meta, pallet.name, ca.name),
                docs: ca.docs,
              }),
            );
            return;
          }
          const ev = pallet.events.find((e) => e.name.toLowerCase() === itemName.toLowerCase());
          if (ev) {
            console.log(
              formatJson({
                chain: chainName,
                pallet: pallet.name,
                item: ev.name,
                category: "event",
                fields: describeEventFields(meta, pallet.name, ev.name),
                docs: ev.docs,
              }),
            );
            return;
          }
          const er = pallet.errors.find((e) => e.name.toLowerCase() === itemName.toLowerCase());
          if (er) {
            console.log(
              formatJson({
                chain: chainName,
                pallet: pallet.name,
                item: er.name,
                category: "error",
                docs: er.docs,
              }),
            );
            return;
          }
          // Not found
          const allItems = [
            ...pallet.storage.map((s) => s.name),
            ...pallet.constants.map((c) => c.name),
            ...pallet.calls.map((c) => c.name),
            ...pallet.events.map((e) => e.name),
            ...pallet.errors.map((e) => e.name),
          ];
          throw new Error(suggestMessage(`item in ${pallet.name}`, itemName, allItems));
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
          console.log(`  ${BOLD}Type:${RESET} ${describeType(meta.lookup, constantItem.typeId)}`);
          if (constantItem.docs.length) {
            console.log();
            printDocs(constantItem.docs);
          }
          console.log();
          return;
        }

        // Search in calls
        const callItem = pallet.calls.find((c) => c.name.toLowerCase() === itemName.toLowerCase());
        if (callItem) {
          printHeading(`${pallet.name}.${callItem.name} (Call)`);
          const args = describeCallArgs(meta, pallet.name, callItem.name);
          console.log(`  ${BOLD}Args:${RESET} ${args}`);
          if (callItem.docs.length) {
            console.log();
            printDocs(callItem.docs);
          }
          console.log();
          return;
        }

        // Search in events
        const eventItem = pallet.events.find(
          (e) => e.name.toLowerCase() === itemName.toLowerCase(),
        );
        if (eventItem) {
          printHeading(`${pallet.name}.${eventItem.name} (Event)`);
          const fields = describeEventFields(meta, pallet.name, eventItem.name);
          console.log(`  ${BOLD}Fields:${RESET} ${fields}`);
          if (eventItem.docs.length) {
            console.log();
            printDocs(eventItem.docs);
          }
          console.log();
          return;
        }

        // Search in errors
        const errorItem = pallet.errors.find(
          (e) => e.name.toLowerCase() === itemName.toLowerCase(),
        );
        if (errorItem) {
          printHeading(`${pallet.name}.${errorItem.name} (Error)`);
          if (errorItem.docs.length) {
            printDocs(errorItem.docs);
          }
          console.log();
          return;
        }

        // Not found — suggest
        const allItems = [
          ...pallet.storage.map((s) => s.name),
          ...pallet.constants.map((c) => c.name),
          ...pallet.calls.map((c) => c.name),
          ...pallet.events.map((e) => e.name),
          ...pallet.errors.map((e) => e.name),
        ];
        throw new Error(suggestMessage(`item in ${pallet.name}`, itemName, allItems));
      },
    );
}
