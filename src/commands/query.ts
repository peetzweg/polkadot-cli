import type { CAC } from "cac";
import { loadConfig, resolveChain } from "../config/store.ts";
import { createChainClient } from "../core/client.ts";
import {
  getOrFetchMetadata,
  findPallet,
  getPalletNames,
} from "../core/metadata.ts";
import { printResult, DIM, RESET, YELLOW } from "../core/output.ts";
import { parseTarget } from "../utils/parse-target.ts";
import { suggestMessage } from "../utils/fuzzy-match.ts";

const DEFAULT_LIMIT = 100;

export function registerQueryCommand(cli: CAC) {
  cli
    .command("query [target] [...keys]", "Query on-chain storage (e.g. System.Number, System.Account <addr>)")
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
          console.log("Usage: dot query <Pallet.Item> [...keys] [--chain <name>] [--output json]");
          console.log("");
          console.log("Examples:");
          console.log("  $ dot query System.Number                         # plain storage value");
          console.log("  $ dot query System.Account 5Grw...                # single map entry");
          console.log("  $ dot query System.Account                        # all entries (limit 100)");
          console.log("  $ dot query System.Account --limit 10             # first 10 entries");
          console.log("  $ dot query System.Account --limit 0              # all entries (no limit)");
          console.log("  $ dot query Assets.Metadata 42 --chain asset-hub");
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
              suggestMessage(
                `storage item in ${palletInfo.name}`,
                item,
                storageNames,
              ),
            );
          }

          const unsafeApi = clientHandle.client.getUnsafeApi();
          const storageApi = (unsafeApi as any).query[palletInfo.name][
            storageItem.name
          ];

          const parsedKeys = keys.map(parseKeyArg);
          const format = opts.output ?? "pretty";

          if (storageItem.type === "map" && parsedKeys.length === 0) {
            // Fetch all entries
            const entries: Array<{ keyArgs: any; value: any }> =
              await storageApi.getEntries();

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

function parseKeyArg(arg: string): unknown {
  // Try number
  if (/^\d+$/.test(arg)) return parseInt(arg, 10);
  // Try bigint for very large numbers
  if (/^\d{16,}$/.test(arg)) return BigInt(arg);
  // Hex
  if (/^0x[0-9a-fA-F]+$/.test(arg)) return arg;
  // Boolean
  if (arg === "true") return true;
  if (arg === "false") return false;
  // JSON
  if (arg.startsWith("{") || arg.startsWith("[")) {
    try {
      return JSON.parse(arg);
    } catch {
      // fall through
    }
  }
  // String (addresses, etc.)
  return arg;
}
