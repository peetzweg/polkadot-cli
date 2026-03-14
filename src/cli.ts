#!/usr/bin/env bun
import cac from "cac";
import { version } from "../package.json";
import { registerAccountCommands } from "./commands/account.ts";
import { registerChainCommands } from "./commands/chain.ts";
import { registerCompletionsCommand } from "./commands/completions.ts";
import { handleConst } from "./commands/const.ts";
import { handleErrors, handleEvents, showItemHelp } from "./commands/focused-inspect.ts";
import { registerHashCommand } from "./commands/hash.ts";
import { registerInspectCommand } from "./commands/inspect.ts";
import { handleQuery } from "./commands/query.ts";
import { handleTx } from "./commands/tx.ts";
import { loadConfig } from "./config/store.ts";
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
    .option("--ext <json>", "Custom signed extension values as JSON (for tx)")
    .option("--limit <n>", "Max entries to return for map queries (0 = unlimited)", {
      default: 100,
    })
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
          ext?: string;
          limit: number;
        },
      ) => {
        if (!dotpath) {
          printHelp();
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
            await handleQuery(target, args, { ...handlerOpts, limit: opts.limit });
            break;
          case "tx":
            // Handle raw hex: if pallet starts with 0x, it's a raw call hex
            if (parsed.pallet && /^0x[0-9a-fA-F]+$/.test(parsed.pallet)) {
              await handleTx(parsed.pallet, args, {
                ...handlerOpts,
                from: opts.from,
                dryRun: opts.dryRun,
                encode: opts.encode,
                ext: opts.ext,
              });
            } else {
              await handleTx(target, args, {
                ...handlerOpts,
                from: opts.from,
                dryRun: opts.dryRun,
                encode: opts.encode,
                ext: opts.ext,
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
        }
      },
    );

  cli.option("--help, -h", "Display this message");
  cli.version(version);

  function printHelp() {
    console.log(`dot/${version} — Polkadot CLI`);
    console.log();
    console.log("Usage:");
    console.log("  dot <category>[.Pallet[.Item]] [args] [options]");
    console.log("  dot [Chain.]<category>[.Pallet[.Item]] [args] [options]");
    console.log();
    console.log("Categories:");
    console.log("  query     Query on-chain storage");
    console.log("  tx        Submit an extrinsic");
    console.log("  const     Look up or list pallet constants");
    console.log("  events    List or inspect pallet events");
    console.log("  errors    List or inspect pallet errors");
    console.log();
    console.log("Examples:");
    console.log("  dot query.System.Account <addr>         Query a storage item");
    console.log("  dot query.System                        List storage items in System");
    console.log("  dot tx.System.remark 0xdead --from alice");
    console.log("  dot const.Balances.ExistentialDeposit");
    console.log("  dot events.Balances                     List events in Balances");
    console.log("  dot polkadot.query.System.Number        With chain prefix");
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
