import type { CAC } from "cac";
import { loadConfig, resolveChain } from "../config/store.ts";
import { createChainClient } from "../core/client.ts";
import {
  getOrFetchMetadata,
  findPallet,
  getPalletNames,
} from "../core/metadata.ts";
import { printResult } from "../core/output.ts";
import { parseTarget } from "../utils/parse-target.ts";
import { suggestMessage } from "../utils/fuzzy-match.ts";

export function registerConstCommand(cli: CAC) {
  cli
    .command("const [target]", "Look up a pallet constant (e.g. Balances.ExistentialDeposit)")
    .action(
      async (
        target: string | undefined,
        opts: { chain?: string; rpc?: string; output?: string },
      ) => {
        if (!target) {
          console.log("Usage: dot const <Pallet.Constant> [--chain <name>] [--output json]");
          console.log("");
          console.log("Examples:");
          console.log("  $ dot const Balances.ExistentialDeposit");
          console.log("  $ dot const System.SS58Prefix --chain kusama");
          return;
        }
        const config = await loadConfig();
        const { name: chainName, chain: chainConfig } = resolveChain(
          config,
          opts.chain,
        );
        const { pallet, item } = parseTarget(target);

        const clientHandle = await createChainClient(
          chainName,
          chainConfig,
          opts.rpc,
        );

        try {
          // Validate pallet/item against metadata
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
            throw new Error(
              suggestMessage(
                `constant in ${palletInfo.name}`,
                item,
                constNames,
              ),
            );
          }

          const unsafeApi = clientHandle.client.getUnsafeApi();
          const runtimeToken = await (unsafeApi as any).runtimeToken;
          const result = (unsafeApi as any).constants[palletInfo.name][
            constantItem.name
          ](runtimeToken);

          printResult(result, opts.output ?? "pretty");
        } finally {
          clientHandle.destroy();
        }
      },
    );
}
