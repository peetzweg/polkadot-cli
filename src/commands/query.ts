import type { CAC } from "cac";
import { loadConfig, resolveChain } from "../config/store.ts";
import { createChainClient } from "../core/client.ts";
import type { MetadataBundle, StorageItemInfo } from "../core/metadata.ts";
import { describeType, findPallet, getOrFetchMetadata, getPalletNames } from "../core/metadata.ts";
import { DIM, printResult, RESET } from "../core/output.ts";
import { suggestMessage } from "../utils/fuzzy-match.ts";
import { parseTarget, resolveTargetChain } from "../utils/parse-target.ts";
import { parseValue } from "../utils/parse-value.ts";
import { parseStructArgs, parseTypedArg } from "./tx.ts";

const DEFAULT_LIMIT = 100;

export function registerQueryCommand(cli: CAC) {
  cli
    .command(
      "query [target] [...keys]",
      "Query on-chain storage (e.g. System.Number, System.Account <addr>)",
    )
    .option("--limit <n>", "Max entries to return for map queries (0 = unlimited)", {
      default: DEFAULT_LIMIT,
    })
    .action(
      async (
        target: string | undefined,
        keys: string[],
        opts: { chain?: string; rpc?: string; output?: string; limit: number },
      ) => {
        if (!target) {
          console.log(
            "Usage: dot query <[Chain.]Pallet.Item> [...keys] [--chain <name>] [--output json]",
          );
          console.log("");
          console.log("Examples:");
          console.log("  $ dot query System.Number                         # plain storage value");
          console.log("  $ dot query System.Account 5Grw...                # single map entry");
          console.log(
            "  $ dot query System.Account                        # all entries (limit 100)",
          );
          console.log("  $ dot query System.Account --limit 10             # first 10 entries");
          console.log(
            "  $ dot query System.Account --limit 0              # all entries (no limit)",
          );
          console.log("  $ dot query Assets.Metadata 42 --chain asset-hub");
          console.log("  $ dot query kusama.System.Account 5Grw...         # chain prefix");
          return;
        }

        const config = await loadConfig();
        const knownChains = Object.keys(config.chains);
        const parsed = parseTarget(target, { knownChains });
        const effectiveChain = resolveTargetChain(parsed, opts.chain);
        const { name: chainName, chain: chainConfig } = resolveChain(config, effectiveChain);
        const pallet = parsed.pallet;
        const item = parsed.item!;

        const clientHandle = await createChainClient(chainName, chainConfig, opts.rpc);

        try {
          const meta = await getOrFetchMetadata(chainName, clientHandle);
          const palletNames = getPalletNames(meta);
          const palletInfo = findPallet(meta, pallet);
          if (!palletInfo) {
            throw new Error(suggestMessage("pallet", pallet, palletNames));
          }

          const storageItem = palletInfo.storage.find(
            (s) => s.name.toLowerCase() === item.toLowerCase(),
          );
          if (!storageItem) {
            const storageNames = palletInfo.storage.map((s) => s.name);
            throw new Error(
              suggestMessage(`storage item in ${palletInfo.name}`, item, storageNames),
            );
          }

          const unsafeApi = clientHandle.client.getUnsafeApi();
          const storageApi = (unsafeApi as any).query[palletInfo.name][storageItem.name];

          const parsedKeys = parseStorageKeys(meta, palletInfo.name, storageItem, keys);
          const format = opts.output ?? "pretty";

          if (storageItem.type === "map" && parsedKeys.length === 0) {
            // Fetch all entries
            const entries: Array<{ keyArgs: any; value: any }> = await storageApi.getEntries();

            const limit = Number(opts.limit);
            const truncated = limit > 0 && entries.length > limit;
            const display = truncated ? entries.slice(0, limit) : entries;

            printResult(
              display.map((e: any) => ({
                keys: e.keyArgs,
                value: e.value,
              })),
              format,
            );

            if (truncated) {
              console.error(
                `\n${DIM}Showing ${limit} of ${entries.length} entries. Use --limit 0 for all.${RESET}`,
              );
            }
          } else {
            // Single value lookup
            const result = await storageApi.getValue(...parsedKeys);
            printResult(result, format);
          }
        } finally {
          clientHandle.destroy();
        }
      },
    );
}

/**
 * Parse CLI key arguments for a storage query using metadata awareness.
 *
 * - Plain storage (no keys): returns []
 * - Single-hasher map with struct key: composes positional args into a struct,
 *   or accepts a single JSON arg
 * - Single-hasher map with non-struct key: parses 1 arg via parseTypedArg
 * - Multi-hasher NMap: parses each CLI arg against its corresponding key type
 */
function parseStorageKeys(
  meta: MetadataBundle,
  palletName: string,
  storageItem: StorageItemInfo,
  args: string[],
): unknown[] {
  // Plain storage — no keys expected
  if (storageItem.type === "plain" || storageItem.keyTypeId == null) {
    return args.map(parseValue);
  }

  // No args provided — caller will use getEntries()
  if (args.length === 0) return [];

  const storageEntry = meta.builder.buildStorage(palletName, storageItem.name);
  const len = storageEntry.len; // number of getValue() arguments (= number of hashers)
  const keyEntry = meta.lookup(storageItem.keyTypeId);

  if (len === 1) {
    // Single-hasher map: getValue() takes exactly 1 argument
    if (args.length === 1) {
      // Single CLI arg — parse it typed (handles JSON structs, primitives, AccountId, etc.)
      return [parseTypedArg(meta, keyEntry, args[0]!)];
    }

    // Multiple CLI args — only valid if the key type is a struct
    if (keyEntry.type === "struct") {
      const label = `${palletName}.${storageItem.name} key`;
      return [parseStructArgs(meta, keyEntry.value, args, label)];
    }

    // Wrong arg count for a non-struct single-hasher key
    const typeDesc = describeType(meta.lookup, storageItem.keyTypeId);
    throw new Error(
      `${palletName}.${storageItem.name} key expects ${typeDesc}\n` +
        `  Pass 1 argument. Got ${args.length}.`,
    );
  }

  // Multi-hasher NMap: getValue() takes N separate arguments
  if (args.length !== len) {
    // Build description of expected key types
    let typeDesc: string;
    if (keyEntry.type === "tuple") {
      typeDesc = (keyEntry.value as any[])
        .map((e: any) => describeType(meta.lookup, e.id))
        .join(", ");
    } else {
      typeDesc = describeType(meta.lookup, storageItem.keyTypeId);
    }
    throw new Error(
      `${palletName}.${storageItem.name} expects ${len} key arg(s): (${typeDesc}). Got ${args.length}.`,
    );
  }

  // Parse each arg against its corresponding tuple element type
  if (keyEntry.type === "tuple") {
    const entries = keyEntry.value as any[];
    return entries.map((entry: any, i: number) => parseTypedArg(meta, entry, args[i]!));
  }

  // Fallback for non-tuple multi-hasher (shouldn't normally happen)
  return args.map((arg) => parseTypedArg(meta, keyEntry, arg));
}

export { parseStorageKeys };
