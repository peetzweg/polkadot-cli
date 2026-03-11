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
  firstSentence,
  printDocs,
  printHeading,
  printItem,
  RESET,
} from "../core/output.ts";
import { suggestMessage } from "../utils/fuzzy-match.ts";

export async function loadMeta(
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

export function resolvePallet(meta: MetadataBundle, palletName: string): PalletInfo {
  const palletNames = getPalletNames(meta);
  const pallet = findPallet(meta, palletName);
  if (!pallet) {
    throw new Error(suggestMessage("pallet", palletName, palletNames));
  }
  return pallet;
}

export async function handleCalls(
  target: string | undefined,
  opts: { chain?: string; rpc?: string },
) {
  if (!target) {
    // List all pallets with call counts
    const config = await loadConfig();
    const { name: chainName, chain: chainConfig } = resolveChain(config, opts.chain);
    const meta = await loadMeta(chainName, chainConfig, opts.rpc);
    const pallets = listPallets(meta);
    const withCalls = pallets.filter((p) => p.calls.length > 0);
    printHeading(`Pallets with calls on ${chainName} (${withCalls.length})`);
    for (const p of withCalls) {
      printItem(p.name, `${p.calls.length} calls`);
    }
    console.log();
    return;
  }

  const config = await loadConfig();
  const { name: chainName, chain: chainConfig } = resolveChain(config, opts.chain);
  const meta = await loadMeta(chainName, chainConfig, opts.rpc);

  // Parse target as Pallet or Pallet.Item
  const dotIdx = target.indexOf(".");
  const palletName = dotIdx === -1 ? target : target.slice(0, dotIdx);
  const itemName = dotIdx === -1 ? undefined : target.slice(dotIdx + 1);

  const pallet = resolvePallet(meta, palletName);

  if (!itemName) {
    // List calls
    if (pallet.calls.length === 0) {
      console.log(`No calls in ${pallet.name}.`);
      return;
    }
    printHeading(`${pallet.name} Calls`);
    for (const c of pallet.calls) {
      const args = describeCallArgs(meta, pallet.name, c.name);
      console.log(`  ${CYAN}${c.name}${RESET}${DIM}${args}${RESET}`);
      const summary = firstSentence(c.docs);
      if (summary) {
        console.log(`      ${DIM}${summary}${RESET}`);
      }
    }
    console.log();
    return;
  }

  // Call detail
  const callItem = pallet.calls.find((c) => c.name.toLowerCase() === itemName.toLowerCase());
  if (!callItem) {
    const names = pallet.calls.map((c) => c.name);
    throw new Error(suggestMessage(`call in ${pallet.name}`, itemName, names));
  }

  printHeading(`${pallet.name}.${callItem.name} (Call)`);
  const args = describeCallArgs(meta, pallet.name, callItem.name);
  console.log(`  ${BOLD}Args:${RESET} ${args}`);
  if (callItem.docs.length) {
    console.log();
    printDocs(callItem.docs);
  }
  console.log();
}

export async function handleEvents(
  target: string | undefined,
  opts: { chain?: string; rpc?: string },
) {
  if (!target) {
    // List all pallets with event counts
    const config = await loadConfig();
    const { name: chainName, chain: chainConfig } = resolveChain(config, opts.chain);
    const meta = await loadMeta(chainName, chainConfig, opts.rpc);
    const pallets = listPallets(meta);
    const withEvents = pallets.filter((p) => p.events.length > 0);
    printHeading(`Pallets with events on ${chainName} (${withEvents.length})`);
    for (const p of withEvents) {
      printItem(p.name, `${p.events.length} events`);
    }
    console.log();
    return;
  }

  const config = await loadConfig();
  const { name: chainName, chain: chainConfig } = resolveChain(config, opts.chain);
  const meta = await loadMeta(chainName, chainConfig, opts.rpc);

  const dotIdx = target.indexOf(".");
  const palletName = dotIdx === -1 ? target : target.slice(0, dotIdx);
  const itemName = dotIdx === -1 ? undefined : target.slice(dotIdx + 1);

  const pallet = resolvePallet(meta, palletName);

  if (!itemName) {
    // List events
    if (pallet.events.length === 0) {
      console.log(`No events in ${pallet.name}.`);
      return;
    }
    printHeading(`${pallet.name} Events`);
    for (const e of pallet.events) {
      const fields = describeEventFields(meta, pallet.name, e.name);
      console.log(`  ${CYAN}${e.name}${RESET}${DIM}${fields}${RESET}`);
      const summary = firstSentence(e.docs);
      if (summary) {
        console.log(`      ${DIM}${summary}${RESET}`);
      }
    }
    console.log();
    return;
  }

  // Event detail
  const eventItem = pallet.events.find((e) => e.name.toLowerCase() === itemName.toLowerCase());
  if (!eventItem) {
    const names = pallet.events.map((e) => e.name);
    throw new Error(suggestMessage(`event in ${pallet.name}`, itemName, names));
  }

  printHeading(`${pallet.name}.${eventItem.name} (Event)`);
  const fields = describeEventFields(meta, pallet.name, eventItem.name);
  console.log(`  ${BOLD}Fields:${RESET} ${fields}`);
  if (eventItem.docs.length) {
    console.log();
    printDocs(eventItem.docs);
  }
  console.log();
}

export async function handleErrors(
  target: string | undefined,
  opts: { chain?: string; rpc?: string },
) {
  if (!target) {
    // List all pallets with error counts
    const config = await loadConfig();
    const { name: chainName, chain: chainConfig } = resolveChain(config, opts.chain);
    const meta = await loadMeta(chainName, chainConfig, opts.rpc);
    const pallets = listPallets(meta);
    const withErrors = pallets.filter((p) => p.errors.length > 0);
    printHeading(`Pallets with errors on ${chainName} (${withErrors.length})`);
    for (const p of withErrors) {
      printItem(p.name, `${p.errors.length} errors`);
    }
    console.log();
    return;
  }

  const config = await loadConfig();
  const { name: chainName, chain: chainConfig } = resolveChain(config, opts.chain);
  const meta = await loadMeta(chainName, chainConfig, opts.rpc);

  const dotIdx = target.indexOf(".");
  const palletName = dotIdx === -1 ? target : target.slice(0, dotIdx);
  const itemName = dotIdx === -1 ? undefined : target.slice(dotIdx + 1);

  const pallet = resolvePallet(meta, palletName);

  if (!itemName) {
    // List errors
    if (pallet.errors.length === 0) {
      console.log(`No errors in ${pallet.name}.`);
      return;
    }
    printHeading(`${pallet.name} Errors`);
    for (const e of pallet.errors) {
      console.log(`  ${CYAN}${e.name}${RESET}`);
      const summary = firstSentence(e.docs);
      if (summary) {
        console.log(`      ${DIM}${summary}${RESET}`);
      }
    }
    console.log();
    return;
  }

  // Error detail
  const errorItem = pallet.errors.find((e) => e.name.toLowerCase() === itemName.toLowerCase());
  if (!errorItem) {
    const names = pallet.errors.map((e) => e.name);
    throw new Error(suggestMessage(`error in ${pallet.name}`, itemName, names));
  }

  printHeading(`${pallet.name}.${errorItem.name} (Error)`);
  if (errorItem.docs.length) {
    printDocs(errorItem.docs);
  }
  console.log();
}

export async function handleStorage(
  target: string | undefined,
  opts: { chain?: string; rpc?: string },
) {
  if (!target) {
    // List all pallets with storage counts
    const config = await loadConfig();
    const { name: chainName, chain: chainConfig } = resolveChain(config, opts.chain);
    const meta = await loadMeta(chainName, chainConfig, opts.rpc);
    const pallets = listPallets(meta);
    const withStorage = pallets.filter((p) => p.storage.length > 0);
    printHeading(`Pallets with storage on ${chainName} (${withStorage.length})`);
    for (const p of withStorage) {
      printItem(p.name, `${p.storage.length} storage`);
    }
    console.log();
    return;
  }

  const config = await loadConfig();
  const { name: chainName, chain: chainConfig } = resolveChain(config, opts.chain);
  const meta = await loadMeta(chainName, chainConfig, opts.rpc);

  const dotIdx = target.indexOf(".");
  const palletName = dotIdx === -1 ? target : target.slice(0, dotIdx);
  const itemName = dotIdx === -1 ? undefined : target.slice(dotIdx + 1);

  const pallet = resolvePallet(meta, palletName);

  if (!itemName) {
    // List storage items
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

  // Storage detail
  const storageItem = pallet.storage.find((s) => s.name.toLowerCase() === itemName.toLowerCase());
  if (!storageItem) {
    const names = pallet.storage.map((s) => s.name);
    throw new Error(suggestMessage(`storage item in ${pallet.name}`, itemName, names));
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
}
