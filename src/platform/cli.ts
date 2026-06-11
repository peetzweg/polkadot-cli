import type { CAC } from "cac";

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
