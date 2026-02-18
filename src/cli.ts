#!/usr/bin/env bun
import cac from "cac";
import { registerChainCommands } from "./commands/chain.ts";
import { registerInspectCommand } from "./commands/inspect.ts";
import { registerQueryCommand } from "./commands/query.ts";
import { registerConstCommand } from "./commands/const.ts";
import { CliError } from "./utils/errors.ts";

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

cli.help();
cli.version("0.1.0");

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

// Handle async errors from command actions
process.on("unhandledRejection", handleError);

try {
  cli.parse();
} catch (err) {
  handleError(err);
}
