import { loadConfig, loadRpcMethods, resolveChain, saveRpcMethods } from "../config/store.ts";
import {
  BOLD,
  CYAN,
  DIM,
  formatJson,
  isJsonOutput,
  printHeading,
  printResult,
  RESET,
  YELLOW,
} from "../core/output.ts";
import { fetchRpcMethods, rpcRequest } from "../core/rpc.ts";
import {
  inferFamily,
  RPC_REGISTRY,
  type RpcFamily,
  type RpcMethodInfo,
} from "../data/rpc-registry.ts";
import { CliError } from "../utils/errors.ts";
import { suggestMessage } from "../utils/fuzzy-match.ts";
import { parseValue } from "../utils/parse-value.ts";

const FAMILY_ORDER: RpcFamily[] = [
  "system",
  "chain",
  "state",
  "author",
  "payment",
  "babe",
  "grandpa",
  "beefy",
  "mmr",
  "offchain",
  "dev",
  "spec",
  "chainHead",
  "chainSpec",
  "transaction",
  "archive",
  "other",
];

interface RpcOpts {
  chain?: string;
  rpc?: string;
  output?: string;
  json?: boolean;
  help?: boolean;
  refresh?: boolean;
}

/**
 * Resolve the method list for a chain. Reads cache; on miss (or with refresh)
 * fetches `rpc_methods` from the node and saves it.
 */
async function getMethodList(
  chainName: string,
  rpcUrl: string | string[],
  refresh: boolean,
): Promise<{ methods: string[]; version: number; fromCache: boolean }> {
  if (!refresh) {
    const cached = await loadRpcMethods(chainName);
    if (cached) {
      return { methods: cached.methods, version: cached.version, fromCache: true };
    }
  }
  const fresh = await fetchRpcMethods(rpcUrl);
  await saveRpcMethods(chainName, fresh.methods, fresh.version);
  return { methods: fresh.methods, version: fresh.version, fromCache: false };
}

function groupByFamily(methods: string[]): Map<RpcFamily, string[]> {
  const groups = new Map<RpcFamily, string[]>();
  for (const m of methods) {
    const family = RPC_REGISTRY[m]?.family ?? inferFamily(m);
    const list = groups.get(family) ?? [];
    list.push(m);
    groups.set(family, list);
  }
  for (const list of groups.values()) list.sort();
  return groups;
}

function formatArgs(info: RpcMethodInfo): string {
  if (info.args.length === 0) return "(no args)";
  return info.args.map((a) => `<${a.name}: ${a.type}${a.optional ? "?" : ""}>`).join(" ");
}

function printMethodHelp(method: string, info: RpcMethodInfo | undefined): void {
  console.log();
  console.log(`${BOLD}${method}${RESET}`);
  if (info) {
    if (info.dangerous) {
      console.log(`  ${YELLOW}⚠️  WRITE / state-changing${RESET}`);
    }
    if (info.subscription) {
      console.log(`  ${DIM}subscription — not callable as a one-shot${RESET}`);
    }
    console.log(`  ${info.description}`);
    console.log();
    console.log(`  ${DIM}Family:${RESET} ${info.family}`);
    console.log(`  ${DIM}Args:${RESET}   ${formatArgs(info)}`);
    if (info.args.some((a) => a.description)) {
      console.log();
      for (const a of info.args) {
        if (a.description) {
          console.log(`    ${CYAN}${a.name}${RESET}  ${DIM}${a.description}${RESET}`);
        }
      }
    }
  } else {
    console.log(
      `  ${DIM}No curated metadata. Args are passed through as raw JSON-RPC params.${RESET}`,
    );
    console.log(`  ${DIM}Family:${RESET} ${inferFamily(method)} (inferred)`);
  }
  console.log();
}

async function listMethods(chainName: string, rpcUrl: string | string[], opts: RpcOpts) {
  const { methods, version, fromCache } = await getMethodList(
    chainName,
    rpcUrl,
    opts.refresh ?? false,
  );

  if (isJsonOutput(opts)) {
    console.log(
      formatJson({
        chain: chainName,
        version,
        fromCache,
        methods: methods.map((m) => {
          const info = RPC_REGISTRY[m];
          return {
            method: m,
            family: info?.family ?? inferFamily(m),
            description: info?.description,
            dangerous: info?.dangerous ?? false,
            subscription: info?.subscription ?? false,
          };
        }),
      }),
    );
    return;
  }

  printHeading(`RPC methods on ${chainName} (${methods.length})`);
  const groups = groupByFamily(methods);
  for (const family of FAMILY_ORDER) {
    const list = groups.get(family);
    if (!list || list.length === 0) continue;
    console.log(`${BOLD}${family}${RESET} ${DIM}(${list.length})${RESET}`);
    for (const m of list) {
      const info = RPC_REGISTRY[m];
      const tags: string[] = [];
      if (info?.dangerous) tags.push(`${YELLOW}⚠ write${RESET}`);
      if (info?.subscription) tags.push(`${DIM}sub${RESET}`);
      const suffix = tags.length > 0 ? ` ${tags.join(" ")}` : "";
      const desc = info?.description ? `  ${DIM}${info.description}${RESET}` : "";
      console.log(`  ${CYAN}${m}${RESET}${suffix}${desc}`);
    }
    console.log();
  }
  if (!fromCache) {
    console.log(`${DIM}(fetched from node — cached for next run)${RESET}`);
  }
}

export async function handleRpc(method: string | undefined, args: string[], opts: RpcOpts) {
  const config = await loadConfig();
  const { name: chainName, chain: chainConfig } = resolveChain(config, opts.chain);
  const rpcUrl = opts.rpc ?? chainConfig.rpc;
  if (!rpcUrl) {
    throw new CliError(
      `No RPC endpoint for chain "${chainName}". Pass --rpc or run \`dot chain add ${chainName} --rpc <url>\`.`,
    );
  }

  // List mode
  if (!method) {
    await listMethods(chainName, rpcUrl, opts);
    return;
  }

  const info = RPC_REGISTRY[method];

  // Help mode
  if (opts.help) {
    printMethodHelp(method, info);
    return;
  }

  // Validate against discovered method list. On first use, fetch and cache it
  // so future runs (and tab completion) are instant.
  const { methods: knownMethods } = await getMethodList(chainName, rpcUrl, opts.refresh ?? false);
  if (!knownMethods.includes(method)) {
    const hint = suggestMessage("method", method, knownMethods);
    throw new CliError(
      `Method "${method}" is not exposed by the node for "${chainName}".${hint ? ` ${hint}` : ""} ` +
        `Run \`dot ${chainName}.rpc --refresh\` if the node has been upgraded.`,
    );
  }

  // Reject subscription methods — they need follow-state we can't reasonably
  // provide as a one-shot CLI call.
  if (info?.subscription) {
    throw new CliError(
      `"${method}" is a subscription method (requires a follow session) and is not callable as a one-shot. ` +
        `Use a long-running client for streaming RPC.`,
    );
  }
  // Detect undeclared subscription-style methods by name (legacy convention).
  if (!info && /(_subscribe|_unsubscribe)/.test(method)) {
    throw new CliError(
      `"${method}" looks like a subscription/unsubscription method and isn't supported as a one-shot. ` +
        `Pass --help to see what we know about it.`,
    );
  }

  // Parse args. If we have curated metadata, validate count.
  if (info) {
    const required = info.args.filter((a) => !a.optional).length;
    if (args.length < required) {
      throw new CliError(
        `"${method}" expects at least ${required} argument(s) (${formatArgs(info)}); got ${args.length}.`,
      );
    }
  }
  const params = args.map(parseValue);

  const result = await rpcRequest<unknown>(rpcUrl, method, params);
  printResult(result, isJsonOutput(opts) ? "json" : opts.output);
}
