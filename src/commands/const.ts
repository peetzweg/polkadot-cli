import { loadConfig, resolveChain } from "../config/store.ts";
import { createChainClient } from "../core/client.ts";
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
import { loadMeta } from "./focused-inspect.ts";

export async function handleConst(
  target: string | undefined,
  opts: { chain?: string; rpc?: string; output?: string },
) {
  if (!target) {
    // List all pallets with constant counts
    const config = await loadConfig();
    const { name: chainName, chain: chainConfig } = resolveChain(config, opts.chain);
    const meta = await loadMeta(chainName, chainConfig, opts.rpc);
    const pallets = listPallets(meta);
    const withConsts = pallets.filter((p) => p.constants.length > 0);
    printHeading(`Pallets with constants on ${chainName} (${withConsts.length})`);
    for (const p of withConsts) {
      printItem(p.name, `${p.constants.length} constants`);
    }
    console.log();
    return;
  }

  // Check if target is pallet-only (no dot)
  const dotIdx = target.indexOf(".");
  const pallet = dotIdx === -1 ? target : target.slice(0, dotIdx);
  const item = dotIdx === -1 ? undefined : target.slice(dotIdx + 1);

  const config = await loadConfig();
  const { name: chainName, chain: chainConfig } = resolveChain(config, opts.chain);

  if (!item) {
    // Listing mode — offline metadata
    const meta = await loadMeta(chainName, chainConfig, opts.rpc);

    const palletNames = getPalletNames(meta);
    const palletInfo = findPallet(meta, pallet);
    if (!palletInfo) {
      throw new Error(suggestMessage("pallet", pallet, palletNames));
    }

    if (palletInfo.constants.length === 0) {
      console.log(`No constants in ${palletInfo.name}.`);
      return;
    }

    printHeading(`${palletInfo.name} Constants`);
    for (const c of palletInfo.constants) {
      const typeStr = describeType(meta.lookup, c.typeId);
      console.log(`  ${CYAN}${c.name}${RESET}${DIM}: ${typeStr}${RESET}`);
      const summary = firstSentence(c.docs);
      if (summary) {
        console.log(`      ${DIM}${summary}${RESET}`);
      }
    }
    console.log();
    return;
  }

  // Value lookup mode — connects to chain
  const clientHandle = await createChainClient(chainName, chainConfig, opts.rpc);

  try {
    const meta = await getOrFetchMetadata(chainName, clientHandle);
    const palletNames = getPalletNames(meta);
    const palletInfo = findPallet(meta, pallet);
    if (!palletInfo) {
      throw new Error(suggestMessage("pallet", pallet, palletNames));
    }

    const constantItem = palletInfo.constants.find(
      (c) => c.name.toLowerCase() === item.toLowerCase(),
    );
    if (!constantItem) {
      const constNames = palletInfo.constants.map((c) => c.name);
      throw new Error(suggestMessage(`constant in ${palletInfo.name}`, item, constNames));
    }

    const unsafeApi = clientHandle.client.getUnsafeApi();
    const runtimeToken = await (unsafeApi as any).runtimeToken;
    const result = (unsafeApi as any).constants[palletInfo.name][constantItem.name](runtimeToken);

    const format = opts.output ?? "pretty";
    printResult(result, format);
  } finally {
    clientHandle.destroy();
  }
}
