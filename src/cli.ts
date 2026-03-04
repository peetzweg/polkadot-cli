#!/usr/bin/env bun
import cac from "cac";
import { version } from "../package.json";
import { registerAccountCommands } from "./commands/account.ts";
import { registerChainCommands } from "./commands/chain.ts";
import { registerConstCommand } from "./commands/const.ts";
import { registerHashCommand } from "./commands/hash.ts";
import { registerInspectCommand } from "./commands/inspect.ts";
import { registerQueryCommand } from "./commands/query.ts";
import { registerTxCommand } from "./commands/tx.ts";
import { getUpdateNotification, startBackgroundCheck } from "./core/update-notifier.ts";
import { CliError } from "./utils/errors.ts";

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
registerQueryCommand(cli);
registerConstCommand(cli);
registerAccountCommands(cli);
registerTxCommand(cli);
registerHashCommand(cli);

cli.help();
cli.version(version);

function showUpdateAndExit(code: number): never {
  const note = getUpdateNotification(version);
  if (note) process.stderr.write(`${note}\n`);
  process.exit(code);
}

function handleError(err: unknown): never {
  if (err instanceof CliError) {
    console.error(`Error: ${err.message}`);
  } else if (err instanceof Error) {
    // CACError for missing args, etc. — show just the message
    console.error(`Error: ${err.message}`);
  } else {
    console.error("An unexpected error occurred:", err);
  }
  showUpdateAndExit(1);
}

try {
  cli.parse(process.argv, { run: false });

  if (cli.options.version || cli.options.help) {
    showUpdateAndExit(0);
  } else if (!(cli as any).matchedCommandName) {
    cli.outputHelp();
    showUpdateAndExit(0);
  } else {
    const result = (cli as any).runMatchedCommand();
    if (result && typeof result.then === "function") {
      result.then(() => showUpdateAndExit(0), handleError);
    }
  }
} catch (err) {
  handleError(err);
}
