#!/usr/bin/env bun
import cac from "cac";
import { registerChainCommands } from "./commands/chain.ts";
import { registerInspectCommand } from "./commands/inspect.ts";
import { registerQueryCommand } from "./commands/query.ts";
import { registerConstCommand } from "./commands/const.ts";
import { registerAccountCommands } from "./commands/account.ts";
import { registerTxCommand } from "./commands/tx.ts";
import { registerHashCommand } from "./commands/hash.ts";
import { CliError } from "./utils/errors.ts";
import { version } from "../package.json";

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

function handleError(err: unknown): never {
  if (err instanceof CliError) {
    console.error(`Error: ${err.message}`);
  } else if (err instanceof Error) {
    // CACError for missing args, etc. — show just the message
    console.error(`Error: ${err.message}`);
  } else {
    console.error("An unexpected error occurred:", err);
  }
  process.exit(1);
}

try {
  cli.parse(process.argv, { run: false });

  if (!(cli as any).matchedCommandName && !cli.options.help && !cli.options.version) {
    cli.outputHelp();
  } else {
    const result = (cli as any).runMatchedCommand();
    if (result && typeof result.then === "function") {
      result.then(() => process.exit(0), handleError);
    }
  }
} catch (err) {
  handleError(err);
}
