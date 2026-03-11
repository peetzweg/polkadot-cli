import { loadConfig, resolveChain } from "../config/store.ts";
import { createChainClient } from "../core/client.ts";
import type { MetadataBundle, StorageItemInfo } from "../core/metadata.ts";
import {
  describeType,
  findPallet,
  getOrFetchMetadata,
  getPalletNames,
  listPallets,
} from "../core/metadata.ts";
import {
  CYAN,
  DIM,
  firstSentence,
  printHeading,
  printItem,
  printResult,
  RESET,
} from "../core/output.ts";
import { suggestMessage } from "../utils/fuzzy-match.ts";
import { parseValue } from "../utils/parse-value.ts";
import { loadMeta, resolvePallet } from "./focused-inspect.ts";
import { parseStructArgs, parseTypedArg } from "./tx.ts";

export async function handleQuery(
  target: string | undefined,
  keys: string[],
  opts: { chain?: string; rpc?: string; output?: string; limit: number },
) {
  if (!target) {
    // List all pallets with storage item counts
    const config = await loadConfig();
    const { name: chainName, chain: chainConfig } = resolveChain(config, opts.chain);
    const meta = await loadMeta(chainName, chainConfig, opts.rpc);
    const pallets = listPallets(meta);
    const withStorage = pallets.filter((p) => p.storage.length > 0);
    printHeading(`Pallets with storage on ${chainName} (${withStorage.length})`);
    for (const p of withStorage) {
      printItem(p.name, `${p.storage.length} storage items`);
    }
    console.log();
    return;
  }

  // Check if target is pallet-only (no dot)
  const dotIdx = target.indexOf(".");
  if (dotIdx === -1) {
    // Listing mode: show storage items in the pallet
    const config = await loadConfig();
    const { name: chainName, chain: chainConfig } = resolveChain(config, opts.chain);
    const meta = await loadMeta(chainName, chainConfig, opts.rpc);
    const pallet = resolvePallet(meta, palletName(target));

    if (pallet.storage.length === 0) {
      console.log(`No storage items in ${pallet.name}.`);
      return;
    }
    printHeading(`${pallet.name} Storage`);
    for (const s of pallet.storage) {
      const valueType = describeType(meta.lookup, s.valueTypeId);
      let typeSuffix: string;
      if (s.keyTypeId != null) {
        const keyType = describeType(meta.lookup, s.keyTypeId);
        typeSuffix = `: ${keyType} → ${valueType}    [map]`;
      } else {
        typeSuffix = `: ${valueType}`;
      }
      console.log(`  ${CYAN}${s.name}${RESET}${DIM}${typeSuffix}${RESET}`);
      const summary = firstSentence(s.docs);
      if (summary) {
        console.log(`      ${DIM}${summary}${RESET}`);
      }
    }
    console.log();
    return;
  }

  const pallet = target.slice(0, dotIdx);
  const item = target.slice(dotIdx + 1);

  const config = await loadConfig();
  const { name: chainName, chain: chainConfig } = resolveChain(config, opts.chain);

  const clientHandle = await createChainClient(chainName, chainConfig, opts.rpc);

  try {
    const meta = await getOrFetchMetadata(chainName, clientHandle);
    const palletNames = getPalletNames(meta);
    const palletInfo = findPallet(meta, pallet);
    if (!palletInfo) {
      throw new Error(suggestMessage("pallet", pallet, palletNames));
    }

    const storageItem = palletInfo.storage.find((s) => s.name.toLowerCase() === item.toLowerCase());
    if (!storageItem) {
      const storageNames = palletInfo.storage.map((s) => s.name);
      throw new Error(suggestMessage(`storage item in ${palletInfo.name}`, item, storageNames));
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
}

function palletName(name: string): string {
  return name;
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
