#!/usr/bin/env bun
import cac from "cac";
import { version } from "../package.json";
import { registerAccountCommands } from "./commands/account.ts";
import { handleApis } from "./commands/apis.ts";
import { registerChainCommands } from "./commands/chain.ts";
import { registerCompletionsCommand } from "./commands/completions.ts";
import { handleConst } from "./commands/const.ts";
import { handleErrors, handleEvents, showItemHelp } from "./commands/focused-inspect.ts";
import { registerHashCommand } from "./commands/hash.ts";
import { registerInspectCommand } from "./commands/inspect.ts";
import { handleQuery } from "./commands/query.ts";
import { handleTx } from "./commands/tx.ts";
import { loadConfig } from "./config/store.ts";
import { isFilePath, loadCommandFile, parseVarFlags } from "./core/file-loader.ts";
import {
  getUpdateNotification,
  startBackgroundCheck,
  waitForPendingCheck,
} from "./core/update-notifier.ts";
import { CliError } from "./utils/errors.ts";
import { parseDotPath } from "./utils/parse-dot-path.ts";

// Early exit for shell completion — avoid loading update checker or heavy imports
if (process.argv[2] === "__complete") {
  (async () => {
    try {
      const dashDashIndex = process.argv.indexOf("--");
      const completionArgs = dashDashIndex >= 0 ? process.argv.slice(dashDashIndex + 1) : [];
      const currentWord = completionArgs[0] ?? "";
      const precedingWords = completionArgs.slice(1);
      const { generateCompletions } = await import("./completions/complete.ts");
      const results = await generateCompletions(currentWord, precedingWords);
      if (results.length > 0) {
        process.stdout.write(`${results.join("\n")}\n`);
      }
    } catch {
      // Silently exit — no completions is better than a broken shell
    }
    process.exit(0);
  })();
} else {
  startBackgroundCheck(version);

  const cli = cac("dot");

  cli.option("--chain <name>", "Target chain (default from config)");
  cli.option("--rpc <url>", "Override RPC endpoint for this call");
  cli.option("--light-client", "Use Smoldot light client instead of WebSocket");
  cli.option("--output <format>", "Output format: pretty or json", {
    default: "pretty",
  });

  registerChainCommands(cli);
  registerInspectCommand(cli);
  registerAccountCommands(cli);
  registerHashCommand(cli);
  registerCompletionsCommand(cli);

  // Default command: dot-path syntax for query, tx, const, events, errors
  cli
    .command("[dotpath] [...args]")
    .option("--from <name>", "Account to sign with (for tx)")
    .option("--dry-run", "Estimate fees without submitting (for tx)")
    .option("--encode", "Encode call to hex without signing (for tx)")
    .option("--yaml", "Decode call to YAML file format (for tx)")
    .option("--json", "Decode call to JSON file format (for tx)")
    .option("--ext <json>", "Custom signed extension values as JSON (for tx)")
    .option(
      "-w, --wait <level>",
      "Resolve at: broadcast, best-block (or best), finalized (for tx)",
      {
        default: "finalized",
      },
    )
    .option("--limit <n>", "Max entries to return for map queries (0 = unlimited)", {
      default: 100,
    })
    .option("--dump", "Dump all entries of a storage map (without specifying a key)")
    .option("--var <kv>", "Template variable for file input (KEY=VALUE, repeatable)")
    .action(
      async (
        dotpath: string | undefined,
        args: string[],
        opts: {
          chain?: string;
          rpc?: string;
          output?: string;
          from?: string;
          dryRun?: boolean;
          encode?: boolean;
          yaml?: boolean;
          json?: boolean;
          ext?: string;
          wait?: string;
          limit: number;
          dump?: boolean;
          var?: string | string[];
        },
      ) => {
        if (!dotpath) {
          printHelp();
          return;
        }

        // --- File-based command input ---
        if (isFilePath(dotpath)) {
          // Collect all --var flags from process.argv (CAC only keeps the last)
          const cliVars = collectVarFlags(process.argv);
          const cmd = await loadCommandFile(dotpath, cliVars);

          // --chain flag overrides file's chain
          const effectiveChain = opts.chain ?? cmd.chain;
          const handlerOpts = { chain: effectiveChain, rpc: opts.rpc, output: opts.output };
          const target = `${cmd.pallet}.${cmd.item}`;

          switch (cmd.category) {
            case "tx":
              await handleTx(target, args, {
                ...handlerOpts,
                from: opts.from,
                dryRun: opts.dryRun,
                encode: opts.encode,
                yaml: opts.yaml,
                json: opts.json,
                ext: opts.ext,
                wait: opts.wait,
                parsedArgs: cmd.args,
              });
              break;
            case "query":
              await handleQuery(target, args, {
                ...handlerOpts,
                limit: opts.limit,
                dump: opts.dump,
                parsedArgs: cmd.args,
              });
              break;
            case "const":
              await handleConst(target, handlerOpts);
              break;
            case "apis":
              await handleApis(target, args, {
                ...handlerOpts,
                parsedArgs: cmd.args,
              });
              break;
          }
          return;
        }

        const config = await loadConfig();
        const knownChains = Object.keys(config.chains);

        let parsed: import("./utils/parse-dot-path.ts").ParsedDotPath;
        try {
          parsed = parseDotPath(dotpath, knownChains);
        } catch {
          throw new CliError(
            `Unknown command "${dotpath}". Run "dot --help" for available commands.`,
          );
        }

        // When dotpath doesn't include pallet/item, absorb them from positional args.
        // Only consume item from args if pallet was also consumed from args,
        // to avoid misinterpreting method arguments as item names
        // (e.g. `dot query.System 0x1234` should NOT treat 0x1234 as an item).
        if (!parsed.pallet && args.length > 0) {
          parsed.pallet = args.shift()!;
          if (!parsed.item && args.length > 0) {
            parsed.item = args.shift()!;
          }
        }

        // Resolve chain: dotpath chain takes precedence, --chain flag as fallback
        if (parsed.chain && opts.chain) {
          throw new CliError(
            `Chain specified both as prefix ("${parsed.chain}") and as --chain flag ("${opts.chain}"). Use one or the other.`,
          );
        }
        const effectiveChain = parsed.chain ?? opts.chain;
        const handlerOpts = { chain: effectiveChain, rpc: opts.rpc, output: opts.output };

        // Build target from pallet + item
        const target = parsed.pallet
          ? parsed.item
            ? `${parsed.pallet}.${parsed.item}`
            : parsed.pallet
          : undefined;

        // Item-level help: show metadata + usage instead of executing
        if (cli.options.help && parsed.pallet && parsed.item) {
          await showItemHelp(parsed.category, target!, handlerOpts);
          return;
        }

        switch (parsed.category) {
          case "query":
            await handleQuery(target, args, { ...handlerOpts, limit: opts.limit, dump: opts.dump });
            break;
          case "tx":
            // Handle raw hex: if pallet starts with 0x, it's a raw call hex
            if (parsed.pallet && /^0x[0-9a-fA-F]+$/.test(parsed.pallet)) {
              await handleTx(parsed.pallet, args, {
                ...handlerOpts,
                from: opts.from,
                dryRun: opts.dryRun,
                encode: opts.encode,
                yaml: opts.yaml,
                json: opts.json,
                ext: opts.ext,
                wait: opts.wait,
              });
            } else {
              await handleTx(target, args, {
                ...handlerOpts,
                from: opts.from,
                dryRun: opts.dryRun,
                encode: opts.encode,
                yaml: opts.yaml,
                json: opts.json,
                ext: opts.ext,
                wait: opts.wait,
              });
            }
            break;
          case "const":
            await handleConst(target, handlerOpts);
            break;
          case "events":
            await handleEvents(target, handlerOpts);
            break;
          case "errors":
            await handleErrors(target, handlerOpts);
            break;
          case "apis":
            await handleApis(target, args, handlerOpts);
            break;
        }
      },
    );

  cli.option("--help, -h", "Display this message");
  cli.version(version);

  /** Collect all --var KEY=VALUE flags from argv (CAC only keeps the last for repeated options) */
  function collectVarFlags(argv: string[]): Record<string, string> {
    const vars: string[] = [];
    for (let i = 0; i < argv.length; i++) {
      if (argv[i] === "--var" && i + 1 < argv.length) {
        vars.push(argv[i + 1]!);
        i++;
      } else if (argv[i]!.startsWith("--var=")) {
        vars.push(argv[i]!.slice(6));
      }
    }
    return parseVarFlags(vars);
  }

  function printHelp() {
    console.log(`dot/${version} — Polkadot CLI`);
    console.log();
    console.log("Usage:");
    console.log("  dot <category>[.Pallet[.Item]] [args] [options]");
    console.log("  dot [Chain.]<category>[.Pallet[.Item]] [args] [options]");
    console.log("  dot <file.yaml|file.json> [options]");
    console.log();
    console.log("Categories:");
    console.log("  query     Query on-chain storage");
    console.log("  tx        Submit an extrinsic");
    console.log("  const     Look up or list pallet constants");
    console.log("  events    List or inspect pallet events");
    console.log("  errors    List or inspect pallet errors");
    console.log("  apis      Browse and call runtime APIs");
    console.log();
    console.log("Examples:");
    console.log("  dot query.System.Account <addr>         Query a storage item");
    console.log("  dot query.System                        List storage items in System");
    console.log("  dot tx.System.remark 0xdead --from alice");
    console.log("  dot const.Balances.ExistentialDeposit");
    console.log("  dot events.Balances                     List events in Balances");
    console.log("  dot apis.Core.version                    Call a runtime API");
    console.log("  dot polkadot.query.System.Number        With chain prefix");
    console.log("  dot ./transfer.yaml --from alice        Run from file");
    console.log("  dot tx.0x1f0003... --yaml               Decode hex call to YAML");
    console.log("  dot tx.System.remark 0xdead --json      Encode & output as JSON file format");
    console.log();
    console.log("Commands:");
    console.log("  inspect [target]   Inspect chain metadata (alias: explore)");
    console.log("  chain              Manage chain configurations");
    console.log("  account            Manage accounts");
    console.log("  hash               Hash utilities");
    console.log("  completions <sh>   Generate shell completions (zsh, bash, fish)");
    console.log();
    console.log("Global options:");
    console.log("  --chain <name>     Target chain (default from config)");
    console.log("  --rpc <url>        Override RPC endpoint");
    console.log("  --light-client     Use Smoldot light client");
    console.log("  --output <format>  Output format: pretty or json");
    console.log("  --help, -h         Display this message");
    console.log("  --version          Show version");
  }

  async function showUpdateAndExit(code: number): Promise<never> {
    await waitForPendingCheck();
    const note = getUpdateNotification(version);
    if (note) process.stderr.write(`${note}\n`);
    process.exit(code);
  }

  async function handleError(err: unknown): Promise<never> {
    if (err instanceof CliError) {
      console.error(`Error: ${err.message}`);
    } else if (err instanceof Error) {
      // CACError for missing args, etc. — show just the message
      console.error(`Error: ${err.message}`);
    } else {
      console.error("An unexpected error occurred:", err);
    }
    return showUpdateAndExit(1);
  }

  async function main() {
    try {
      cli.parse(process.argv, { run: false });

      if (cli.options.version) {
        await showUpdateAndExit(0);
      } else if (cli.options.help) {
        if ((cli as any).matchedCommand) {
          // A named command matched — let it show its own help
          const result = (cli as any).runMatchedCommand();
          if (result && typeof result.then === "function") {
            await result.then(() => showUpdateAndExit(0), handleError);
          }
        } else {
          printHelp();
          await showUpdateAndExit(0);
        }
      } else if (!(cli as any).matchedCommand) {
        printHelp();
        await showUpdateAndExit(0);
      } else {
        const result = (cli as any).runMatchedCommand();
        if (result && typeof result.then === "function") {
          await result.then(() => showUpdateAndExit(0), handleError);
        }
      }
    } catch (err) {
      await handleError(err);
    }
  }

  main();
} // end __complete early-exit else block
