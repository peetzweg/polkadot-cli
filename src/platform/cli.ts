import type { CAC, Command } from "cac";

/**
 * Per-command `--help` text printers, keyed by the command's first name token
 * (e.g. `account`, `chain`, `sign`). Commands register their rich usage block
 * here so `--help` prints proper usage for nested subcommands
 * (`dot account add --help`, `dot chain add --help`, …) instead of running the
 * action and failing on the missing positional argument.
 */
const commandHelpPrinters = new Map<string, () => void>();

/** Extract the leading command-name token (e.g. `account` from `account [action] [...names]`). */
function commandKey(command: Command): string {
  return command.name.split(/\s+/)[0] ?? command.name;
}

/**
 * Associate a help printer with a `cac` command so `--help` prints proper usage
 * even when an action positional is present (the bug behind #238). Pass a custom
 * printer for commands with a rich usage block; omit it to fall back to `cac`'s
 * auto-generated per-command help. Returns the command for chaining.
 */
export function withHelp(command: Command, printHelp?: () => void): Command {
  commandHelpPrinters.set(commandKey(command), printHelp ?? (() => command.outputHelp()));
  return command;
}

/**
 * Print the registered help for the matched command. Returns true if the
 * matched command had a registered help printer (and it was printed). Commands
 * without a registered printer — notably the default dot-path command, which
 * handles item-level help inside its own action — return false so the caller
 * can fall through to running them.
 */
export function printMatchedCommandHelp(cli: CAC): boolean {
  const matched = (cli as unknown as { matchedCommand?: Command }).matchedCommand;
  if (!matched) return false;
  const printer = commandHelpPrinters.get(commandKey(matched));
  if (!printer) return false;
  printer();
  return true;
}

/**
 * Register the shared global options on a `cac` instance. Kept in one place so
 * every entry point exposes an identical surface.
 */
export function registerGlobalOptions(cli: CAC): void {
  cli.option("--chain <name>", "Target chain (required)");
  cli.option("--rpc <url>", "Override RPC endpoint for this call");
  cli.option("--output <format>", "Output format: pretty or json", {
    default: "pretty",
  });
  cli.option("--json", "Output as JSON (shorthand for --output json)");
}

/**
 * Read `--name <value>` / `--name=value` straight from raw argv. CAC delegates
 * to mri, which silently coerces 0x-hex option values to JS Numbers (losing
 * bytes / precision) — re-reading from argv keeps the original string intact.
 * Mirrors mri's rules where it matters: scanning stops at the `--` terminator
 * and the last occurrence wins. Matching is exact (`--name` or `--name=`), so
 * sibling flags that share a prefix (e.g. `--member` vs `--members`) never
 * collide.
 */
export function readRawOptionValue(
  name: string,
  argv: readonly string[] = process.argv,
): string | undefined {
  const flag = `--${name}`;
  const prefix = `${flag}=`;
  let value: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--") break;
    if (arg === flag && i + 1 < argv.length) value = argv[i + 1];
    else if (arg.startsWith(prefix)) value = arg.slice(prefix.length);
  }
  return value;
}
