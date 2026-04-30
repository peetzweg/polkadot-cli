import { loadConfig, resolveChain } from "../config/store.ts";
import { createChainClient } from "../core/client.ts";
import type { MetadataBundle, RuntimeApiMethodInfo } from "../core/metadata.ts";
import {
  describeRuntimeApiMethodArgs,
  describeType,
  findRuntimeApi,
  getOrFetchMetadata,
  getRuntimeApiNames,
  listRuntimeApis,
} from "../core/metadata.ts";
import {
  BOLD,
  CYAN,
  DIM,
  firstSentence,
  formatJson,
  isJsonOutput,
  printHeading,
  printItem,
  printResult,
  RESET,
  YELLOW,
} from "../core/output.ts";
import { suggestMessage } from "../utils/fuzzy-match.ts";
import { loadMeta } from "./focused-inspect.ts";
import { parseTypedArg } from "./tx.ts";

export async function handleApis(
  target: string | undefined,
  args: string[],
  opts: {
    chain?: string;
    rpc?: string;
    output?: string;
    json?: boolean;
    /** Pre-parsed args from a file */
    parsedArgs?: unknown;
  },
) {
  if (!target) {
    const config = await loadConfig();
    const { name: chainName, chain: chainConfig } = resolveChain(config, opts.chain);
    const meta = await loadMeta(chainName, chainConfig, opts.rpc);
    const apis = listRuntimeApis(meta);

    if (isJsonOutput(opts)) {
      console.log(
        formatJson({
          chain: chainName,
          apis: apis.map((a) => ({ name: a.name, methods: a.methods.length })),
        }),
      );
      return;
    }

    printHeading(`Runtime APIs on ${chainName} (${apis.length})`);
    for (const api of apis) {
      printItem(api.name, `${api.methods.length} methods`);
    }
    if (apis.length === 0 && meta.version < 15) {
      console.log(
        `${YELLOW}Hint: Cached metadata is v${meta.version} which does not include runtime API info.${RESET}`,
      );
      console.log();
      console.log(`  ${BOLD}dot chain update ${chainName}${RESET}`);
      console.log();
    }
    console.log();
    return;
  }

  // Parse target as ApiName or ApiName.method
  const dotIdx = target.indexOf(".");
  const apiName = dotIdx === -1 ? target : target.slice(0, dotIdx);
  const methodName = dotIdx === -1 ? undefined : target.slice(dotIdx + 1);

  const config = await loadConfig();
  const { name: chainName, chain: chainConfig } = resolveChain(config, opts.chain);

  if (!methodName) {
    // List methods in a specific API
    const meta = await loadMeta(chainName, chainConfig, opts.rpc);
    const api = resolveRuntimeApi(meta, apiName);

    if (api.methods.length === 0) {
      if (isJsonOutput(opts)) {
        console.log(formatJson({ chain: chainName, api: api.name, methods: [] }));
      } else {
        console.log(`No methods in ${api.name}.`);
      }
      return;
    }

    if (isJsonOutput(opts)) {
      console.log(
        formatJson({
          chain: chainName,
          api: api.name,
          methods: api.methods.map((m) => ({
            name: m.name,
            args: describeRuntimeApiMethodArgs(meta, m),
            returns: describeType(meta.lookup, m.output),
            docs: firstSentence(m.docs),
          })),
        }),
      );
      return;
    }

    printHeading(`${api.name} Methods`);
    for (const m of api.methods) {
      // Listing view: keep signatures compact (single-line) regardless of width
      // so the API overview stays scannable. Use the focused detail page
      // (`dot <chain>.apis.<Api>.<method> --help`) for the pretty-printed
      // multi-line breakdown of complex args / return types.
      const argStr = describeRuntimeApiMethodArgs(meta, m);
      const retStr = describeType(meta.lookup, m.output);
      console.log(`  ${CYAN}${m.name}${RESET}${DIM}${argStr} → ${retStr}${RESET}`);
      const summary = firstSentence(m.docs);
      if (summary) {
        console.log(`      ${DIM}${summary}${RESET}`);
      }
    }
    console.log();
    return;
  }

  // Call a runtime API method
  const clientHandle = await createChainClient(chainName, chainConfig, opts.rpc);

  try {
    const meta = await getOrFetchMetadata(chainName, clientHandle);
    const api = resolveRuntimeApi(meta, apiName);

    const method = api.methods.find((m) => m.name.toLowerCase() === methodName.toLowerCase());
    if (!method) {
      const names = api.methods.map((m) => m.name);
      throw new Error(suggestMessage(`method in ${api.name}`, methodName, names));
    }

    // Merge file args into positional args
    const effectiveArgs =
      args.length > 0 || opts.parsedArgs == null
        ? args
        : Array.isArray(opts.parsedArgs)
          ? opts.parsedArgs.map((v: unknown) =>
              typeof v === "object" ? JSON.stringify(v) : String(v),
            )
          : [
              typeof opts.parsedArgs === "object"
                ? JSON.stringify(opts.parsedArgs)
                : String(opts.parsedArgs),
            ];
    const parsedArgs = await parseRuntimeApiArgs(meta, method, effectiveArgs);

    const unsafeApi = clientHandle.client.getUnsafeApi();
    const result = await (unsafeApi as any).apis[api.name][method.name](...parsedArgs);

    const format = isJsonOutput(opts) ? "json" : (opts.output ?? "pretty");
    printResult(result, format);
  } finally {
    clientHandle.destroy();
  }
}

function resolveRuntimeApi(meta: MetadataBundle, apiName: string) {
  const apiNames = getRuntimeApiNames(meta);
  const api = findRuntimeApi(meta, apiName);
  if (!api) {
    throw new Error(suggestMessage("runtime API", apiName, apiNames));
  }
  return api;
}

async function parseRuntimeApiArgs(
  meta: MetadataBundle,
  method: RuntimeApiMethodInfo,
  args: string[],
): Promise<unknown[]> {
  if (method.inputs.length === 0) return [];

  if (args.length !== method.inputs.length) {
    const argDesc = method.inputs
      .map((i) => `${i.name}: ${describeType(meta.lookup, i.type)}`)
      .join(", ");
    throw new Error(
      `${method.name} expects ${method.inputs.length} arg(s): (${argDesc}). Got ${args.length}.`,
    );
  }

  return Promise.all(
    method.inputs.map((input, i) => {
      const entry = meta.lookup(input.type);
      return parseTypedArg(meta, entry, args[i]!);
    }),
  );
}
