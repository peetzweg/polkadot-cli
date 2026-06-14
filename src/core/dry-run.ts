import { BOLD, RESET, YELLOW } from "./output.ts";

/**
 * Whether the global `DOT_DRY_RUN` environment variable is set to a truthy value.
 *
 * Truthy values (case-insensitive): "1", "true", "yes", "on".
 * Anything else (including unset, "0", "false") is treated as off.
 *
 * When active, every extrinsic-submitting command behaves as if `--dry-run`
 * was passed: it simulates the transaction and never submits it.
 */
export function isGlobalDryRun(): boolean {
  const raw = process.env.DOT_DRY_RUN?.trim().toLowerCase();
  if (raw === undefined || raw === "") return false;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

/**
 * Resolve the effective dry-run setting for a tx command.
 *
 * Precedence (highest first):
 *   1. An explicit `--dry-run` / `--no-dry-run` flag (explicitFlag is a boolean).
 *   2. The `DOT_DRY_RUN` environment variable (when set to a truthy value).
 *   3. Off.
 *
 * `explicitFlag` is `undefined` when no flag was passed on the command line.
 *
 * `decodeOnly` indicates a non-submitting path (`--encode`/`--to-yaml`/`--to-json`).
 * Those never broadcast an extrinsic, so the env var must NOT force dry-run on
 * them (it would otherwise trip the mutual-exclusivity guards). An explicit
 * `--dry-run` flag still wins and surfaces the existing conflict error.
 */
export function resolveDryRun(explicitFlag: boolean | undefined, decodeOnly = false): boolean {
  if (explicitFlag !== undefined) return explicitFlag;
  if (decodeOnly) return false;
  return isGlobalDryRun();
}

/**
 * Print a prominent hint that DOT_DRY_RUN is active. Written to stderr so it
 * never corrupts `--json` (or any other) output on stdout.
 *
 * Idempotent within a process: the banner is printed at most once.
 */
let hintPrinted = false;
export function printGlobalDryRunHint(): void {
  if (hintPrinted) return;
  hintPrinted = true;
  process.stderr.write(
    `${YELLOW}${BOLD}⚠ DOT_DRY_RUN is set${RESET}${YELLOW} — extrinsics will be simulated, not submitted.${RESET}\n`,
  );
}

/** Test-only: reset the once-per-process latch for the hint banner. */
export function __resetDryRunHintForTests(): void {
  hintPrinted = false;
}
