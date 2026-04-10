import { loadConfig, resolveChain } from "../config/store.ts";
import { createChainClient } from "../core/client.ts";
import type { MetadataBundle, PalletInfo } from "../core/metadata.ts";
import {
  describeCallArgs,
  describeEventFields,
  describeRuntimeApiMethodArgs,
  describeType,
  findPallet,
  findRuntimeApi,
  getOrFetchMetadata,
  getPalletNames,
  getRuntimeApiNames,
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
import type { DotCategory } from "../utils/parse-dot-path.ts";

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
  opts: { chain?: string; rpc?: string; output?: string; json?: boolean },
) {
  if (!target) {
    const config = await loadConfig();
    const { name: chainName, chain: chainConfig } = resolveChain(config, opts.chain);
    const meta = await loadMeta(chainName, chainConfig, opts.rpc);
    const pallets = listPallets(meta);
    const withCalls = pallets.filter((p) => p.calls.length > 0);

    if (isJsonOutput(opts)) {
      console.log(
        formatJson({
          chain: chainName,
          pallets: withCalls.map((p) => ({ name: p.name, calls: p.calls.length })),
        }),
      );
      return;
    }

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

  const dotIdx = target.indexOf(".");
  const palletName = dotIdx === -1 ? target : target.slice(0, dotIdx);
  const itemName = dotIdx === -1 ? undefined : target.slice(dotIdx + 1);

  const pallet = resolvePallet(meta, palletName);

  if (!itemName) {
    if (pallet.calls.length === 0) {
      if (isJsonOutput(opts)) {
        console.log(formatJson({ chain: chainName, pallet: pallet.name, calls: [] }));
      } else {
        console.log(`No calls in ${pallet.name}.`);
      }
      return;
    }

    if (isJsonOutput(opts)) {
      console.log(
        formatJson({
          chain: chainName,
          pallet: pallet.name,
          calls: pallet.calls.map((c) => ({
            name: c.name,
            args: describeCallArgs(meta, pallet.name, c.name),
            docs: firstSentence(c.docs),
          })),
        }),
      );
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

  const callItem = pallet.calls.find((c) => c.name.toLowerCase() === itemName.toLowerCase());
  if (!callItem) {
    const names = pallet.calls.map((c) => c.name);
    throw new Error(suggestMessage(`call in ${pallet.name}`, itemName, names));
  }

  if (isJsonOutput(opts)) {
    console.log(
      formatJson({
        chain: chainName,
        pallet: pallet.name,
        item: callItem.name,
        category: "call",
        args: describeCallArgs(meta, pallet.name, callItem.name),
        docs: callItem.docs,
      }),
    );
    return;
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
  opts: { chain?: string; rpc?: string; output?: string; json?: boolean },
) {
  if (!target) {
    const config = await loadConfig();
    const { name: chainName, chain: chainConfig } = resolveChain(config, opts.chain);
    const meta = await loadMeta(chainName, chainConfig, opts.rpc);
    const pallets = listPallets(meta);
    const withEvents = pallets.filter((p) => p.events.length > 0);

    if (isJsonOutput(opts)) {
      console.log(
        formatJson({
          chain: chainName,
          pallets: withEvents.map((p) => ({ name: p.name, events: p.events.length })),
        }),
      );
      return;
    }

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
    if (pallet.events.length === 0) {
      if (isJsonOutput(opts)) {
        console.log(formatJson({ chain: chainName, pallet: pallet.name, events: [] }));
      } else {
        console.log(`No events in ${pallet.name}.`);
      }
      return;
    }

    if (isJsonOutput(opts)) {
      console.log(
        formatJson({
          chain: chainName,
          pallet: pallet.name,
          events: pallet.events.map((e) => ({
            name: e.name,
            fields: describeEventFields(meta, pallet.name, e.name),
            docs: firstSentence(e.docs),
          })),
        }),
      );
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

  const eventItem = pallet.events.find((e) => e.name.toLowerCase() === itemName.toLowerCase());
  if (!eventItem) {
    const names = pallet.events.map((e) => e.name);
    throw new Error(suggestMessage(`event in ${pallet.name}`, itemName, names));
  }

  if (isJsonOutput(opts)) {
    console.log(
      formatJson({
        chain: chainName,
        pallet: pallet.name,
        item: eventItem.name,
        category: "event",
        fields: describeEventFields(meta, pallet.name, eventItem.name),
        docs: eventItem.docs,
      }),
    );
    return;
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
  opts: { chain?: string; rpc?: string; output?: string; json?: boolean },
) {
  if (!target) {
    const config = await loadConfig();
    const { name: chainName, chain: chainConfig } = resolveChain(config, opts.chain);
    const meta = await loadMeta(chainName, chainConfig, opts.rpc);
    const pallets = listPallets(meta);
    const withErrors = pallets.filter((p) => p.errors.length > 0);

    if (isJsonOutput(opts)) {
      console.log(
        formatJson({
          chain: chainName,
          pallets: withErrors.map((p) => ({ name: p.name, errors: p.errors.length })),
        }),
      );
      return;
    }

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
    if (pallet.errors.length === 0) {
      if (isJsonOutput(opts)) {
        console.log(formatJson({ chain: chainName, pallet: pallet.name, errors: [] }));
      } else {
        console.log(`No errors in ${pallet.name}.`);
      }
      return;
    }

    if (isJsonOutput(opts)) {
      console.log(
        formatJson({
          chain: chainName,
          pallet: pallet.name,
          errors: pallet.errors.map((e) => ({ name: e.name, docs: firstSentence(e.docs) })),
        }),
      );
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

  const errorItem = pallet.errors.find((e) => e.name.toLowerCase() === itemName.toLowerCase());
  if (!errorItem) {
    const names = pallet.errors.map((e) => e.name);
    throw new Error(suggestMessage(`error in ${pallet.name}`, itemName, names));
  }

  if (isJsonOutput(opts)) {
    console.log(
      formatJson({
        chain: chainName,
        pallet: pallet.name,
        item: errorItem.name,
        category: "error",
        docs: errorItem.docs,
      }),
    );
    return;
  }

  printHeading(`${pallet.name}.${errorItem.name} (Error)`);
  if (errorItem.docs.length) {
    printDocs(errorItem.docs);
  }
  console.log();
}

export async function handleStorage(
  target: string | undefined,
  opts: { chain?: string; rpc?: string; output?: string; json?: boolean },
) {
  if (!target) {
    const config = await loadConfig();
    const { name: chainName, chain: chainConfig } = resolveChain(config, opts.chain);
    const meta = await loadMeta(chainName, chainConfig, opts.rpc);
    const pallets = listPallets(meta);
    const withStorage = pallets.filter((p) => p.storage.length > 0);

    if (isJsonOutput(opts)) {
      console.log(
        formatJson({
          chain: chainName,
          pallets: withStorage.map((p) => ({ name: p.name, storage: p.storage.length })),
        }),
      );
      return;
    }

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
    if (pallet.storage.length === 0) {
      if (isJsonOutput(opts)) {
        console.log(formatJson({ chain: chainName, pallet: pallet.name, storage: [] }));
      } else {
        console.log(`No storage items in ${pallet.name}.`);
      }
      return;
    }

    if (isJsonOutput(opts)) {
      console.log(
        formatJson({
          chain: chainName,
          pallet: pallet.name,
          storage: pallet.storage.map((s) => {
            const valueType = describeType(meta.lookup, s.valueTypeId);
            const keyType =
              s.keyTypeId != null ? describeType(meta.lookup, s.keyTypeId) : undefined;
            return { name: s.name, type: s.type, valueType, keyType, docs: firstSentence(s.docs) };
          }),
        }),
      );
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

  const storageItem = pallet.storage.find((s) => s.name.toLowerCase() === itemName.toLowerCase());
  if (!storageItem) {
    const names = pallet.storage.map((s) => s.name);
    throw new Error(suggestMessage(`storage item in ${pallet.name}`, itemName, names));
  }

  if (isJsonOutput(opts)) {
    const valueType = describeType(meta.lookup, storageItem.valueTypeId);
    const keyType =
      storageItem.keyTypeId != null ? describeType(meta.lookup, storageItem.keyTypeId) : undefined;
    console.log(
      formatJson({
        chain: chainName,
        pallet: pallet.name,
        item: storageItem.name,
        category: "storage",
        type: storageItem.type,
        valueType,
        keyType,
        docs: storageItem.docs,
      }),
    );
    return;
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

export async function showItemHelp(
  category: DotCategory,
  target: string,
  opts: { chain?: string; rpc?: string; output?: string; json?: boolean },
): Promise<void> {
  const config = await loadConfig();
  const { name: chainName, chain: chainConfig } = resolveChain(config, opts.chain);
  const meta = await loadMeta(chainName, chainConfig, opts.rpc);

  // Runtime APIs are not pallet-based — handle separately
  if (category === "apis") {
    const dotIdx = target.indexOf(".");
    const apiName = dotIdx === -1 ? target : target.slice(0, dotIdx);
    const methodName = dotIdx === -1 ? undefined : target.slice(dotIdx + 1);

    const apiNames = getRuntimeApiNames(meta);
    const api = findRuntimeApi(meta, apiName);
    if (!api) {
      throw new Error(suggestMessage("runtime API", apiName, apiNames));
    }

    if (!methodName) {
      // API-level help: list methods
      const { handleApis } = await import("./apis.ts");
      await handleApis(target, [], opts);
      return;
    }

    const method = api.methods.find((m) => m.name.toLowerCase() === methodName.toLowerCase());
    if (!method) {
      const names = api.methods.map((m) => m.name);
      throw new Error(suggestMessage(`method in ${api.name}`, methodName, names));
    }

    printHeading(`${api.name}.${method.name} (Runtime API)`);
    const argStr = describeRuntimeApiMethodArgs(meta, method);
    const retStr = describeType(meta.lookup, method.output);
    console.log(`  ${BOLD}Args:${RESET} ${argStr}`);
    console.log(`  ${BOLD}Returns:${RESET} ${retStr}`);
    if (method.docs.length) {
      console.log();
      printDocs(method.docs);
    }
    console.log();
    console.log(`${BOLD}Usage:${RESET}`);
    console.log(`  dot apis.${api.name}.${method.name}`);
    console.log();
    return;
  }

  const dotIdx = target.indexOf(".");
  const palletName = dotIdx === -1 ? target : target.slice(0, dotIdx);
  const itemName = dotIdx === -1 ? undefined : target.slice(dotIdx + 1);

  const pallet = resolvePallet(meta, palletName);

  if (!itemName) {
    // Pallet-level: delegate to existing listing handlers
    switch (category) {
      case "tx":
        await handleCalls(target, opts);
        return;
      case "query":
        await handleStorage(target, opts);
        return;
      case "const":
        // No handleConst listing here — caller should not reach this for pallet-only
        return;
      case "events":
        await handleEvents(target, opts);
        return;
      case "errors":
        await handleErrors(target, opts);
        return;
    }
  }

  switch (category) {
    case "tx": {
      const callItem = pallet.calls.find((c) => c.name.toLowerCase() === itemName!.toLowerCase());
      if (!callItem) {
        const names = pallet.calls.map((c) => c.name);
        throw new Error(suggestMessage(`call in ${pallet.name}`, itemName!, names));
      }
      printHeading(`${pallet.name}.${callItem.name} (Call)`);
      const args = describeCallArgs(meta, pallet.name, callItem.name);
      console.log(`  ${BOLD}Args:${RESET} ${args}`);
      if (callItem.docs.length) {
        console.log();
        printDocs(callItem.docs);
      }
      console.log();
      console.log(`${BOLD}Usage:${RESET}`);
      console.log(`  dot tx.${pallet.name}.${callItem.name} --from <account>`);
      console.log(`  dot tx.${pallet.name}.${callItem.name} --encode`);
      console.log();
      console.log(`${BOLD}Options:${RESET}`);
      console.log(`  --from <name>    Account to sign with`);
      console.log(`  --dry-run        Estimate fees without submitting`);
      console.log(`  --encode         Encode call to hex without signing`);
      console.log(`  --ext <json>     Custom signed extension values as JSON`);
      console.log();
      return;
    }

    case "query": {
      const storageItem = pallet.storage.find(
        (s) => s.name.toLowerCase() === itemName!.toLowerCase(),
      );
      if (!storageItem) {
        const names = pallet.storage.map((s) => s.name);
        throw new Error(suggestMessage(`storage item in ${pallet.name}`, itemName!, names));
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
      if (storageItem.keyTypeId != null) {
        console.log(`${BOLD}Usage:${RESET}`);
        console.log(`  dot query.${pallet.name}.${storageItem.name} <key>`);
        console.log(`  dot query.${pallet.name}.${storageItem.name} --dump       # all entries`);
      } else {
        console.log(`${BOLD}Usage:${RESET}`);
        console.log(`  dot query.${pallet.name}.${storageItem.name}`);
      }
      console.log();
      console.log(`${BOLD}Options:${RESET}`);
      console.log(
        `  --dump           Dump all entries of a map (required for keyless map queries)`,
      );
      console.log();
      return;
    }

    case "const": {
      const constItem = pallet.constants.find(
        (c) => c.name.toLowerCase() === itemName!.toLowerCase(),
      );
      if (!constItem) {
        const names = pallet.constants.map((c) => c.name);
        throw new Error(suggestMessage(`constant in ${pallet.name}`, itemName!, names));
      }
      printHeading(`${pallet.name}.${constItem.name} (Constant)`);
      console.log(`  ${BOLD}Type:${RESET} ${describeType(meta.lookup, constItem.typeId)}`);
      if (constItem.docs.length) {
        console.log();
        printDocs(constItem.docs);
      }
      console.log();
      console.log(`${BOLD}Usage:${RESET}`);
      console.log(`  dot const.${pallet.name}.${constItem.name}`);
      console.log();
      return;
    }

    case "events": {
      const eventItem = pallet.events.find((e) => e.name.toLowerCase() === itemName!.toLowerCase());
      if (!eventItem) {
        const names = pallet.events.map((e) => e.name);
        throw new Error(suggestMessage(`event in ${pallet.name}`, itemName!, names));
      }
      printHeading(`${pallet.name}.${eventItem.name} (Event)`);
      const fields = describeEventFields(meta, pallet.name, eventItem.name);
      console.log(`  ${BOLD}Fields:${RESET} ${fields}`);
      if (eventItem.docs.length) {
        console.log();
        printDocs(eventItem.docs);
      }
      console.log();
      console.log(`${BOLD}Usage:${RESET}`);
      console.log(`  dot events.${pallet.name}.${eventItem.name}`);
      console.log();
      return;
    }

    case "errors": {
      const errorItem = pallet.errors.find((e) => e.name.toLowerCase() === itemName!.toLowerCase());
      if (!errorItem) {
        const names = pallet.errors.map((e) => e.name);
        throw new Error(suggestMessage(`error in ${pallet.name}`, itemName!, names));
      }
      printHeading(`${pallet.name}.${errorItem.name} (Error)`);
      if (errorItem.docs.length) {
        printDocs(errorItem.docs);
      }
      console.log();
      console.log(`${BOLD}Usage:${RESET}`);
      console.log(`  dot errors.${pallet.name}.${errorItem.name}`);
      console.log();
      return;
    }
  }
}
