import type { CAC } from "cac";
import { loadConfig, resolveChain } from "../config/store.ts";
import { createChainClient } from "../core/client.ts";
import type { MetadataBundle } from "../core/metadata.ts";
import { describeType, findPallet, getOrFetchMetadata, getPalletNames } from "../core/metadata.ts";
import { CYAN, DIM, firstSentence, printHeading, printResult, RESET } from "../core/output.ts";
import { suggestMessage } from "../utils/fuzzy-match.ts";
import { parseTarget, resolveTargetChain } from "../utils/parse-target.ts";

export function registerConstCommand(cli: CAC) {
  cli
    .command(
      "const [target]",
      "Look up or list pallet constants (e.g. Balances.ExistentialDeposit)",
    )
    .alias("consts")
    .alias("constants")
    .action(
      async (
        target: string | undefined,
        opts: { chain?: string; rpc?: string; output?: string },
      ) => {
        if (!target) {
          console.log(
            "Usage: dot const <[Chain.]Pallet[.Constant]> [--chain <name>] [--output json]",
          );
          console.log("");
          console.log("Examples:");
          console.log("  $ dot const Balances                              # list constants");
          console.log("  $ dot const Balances.ExistentialDeposit           # look up value");
          console.log("  $ dot const System.SS58Prefix --chain kusama");
          console.log("  $ dot const kusama.Balances.ExistentialDeposit    # chain prefix");
          return;
        }
        const config = await loadConfig();
        const knownChains = Object.keys(config.chains);
        const parsed = parseTarget(target, { knownChains, allowPalletOnly: true });
        const effectiveChain = resolveTargetChain(parsed, opts.chain);
        const { name: chainName, chain: chainConfig } = resolveChain(config, effectiveChain);
        const pallet = parsed.pallet;
        const item = parsed.item;

        if (!item) {
          // Listing mode — offline metadata
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
          const result = (unsafeApi as any).constants[palletInfo.name][constantItem.name](
            runtimeToken,
          );

          const format = opts.output ?? "pretty";
          printResult(result, format);
        } finally {
          clientHandle.destroy();
        }
      },
    );
}
