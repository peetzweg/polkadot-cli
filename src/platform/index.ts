/**
 * Platform surface — the curated shared-infra a feature vertical (e.g.
 * `features/verifiable`) is allowed to depend on. A vertical imports only from
 * here (and its own `./lib.ts`), never reaching into `core/`, `config/`, or
 * `commands/` directly. This is the single file you read to know a vertical's
 * full platform dependency, and the only resolution a future standalone bin
 * (`src/bin/<feature>.ts`) relies on.
 *
 * The underlying modules stay where they are (in `core/`, `config/`, `utils/`)
 * — this barrel re-exports rather than relocates, to avoid churning the ~30
 * core-`dot` files that import them.
 */
export { findAccount, loadAccounts, saveAccounts } from "../config/accounts-store.ts";
export { isWatchOnly } from "../config/accounts-types.ts";
export { loadConfig, resolveChain } from "../config/store.ts";
export {
  DEV_NAMES,
  fromSs58,
  isDevAccount,
  isHexPublicKey,
  publicKeyToHex,
  resolveSecret,
} from "../core/accounts.ts";
export { createChainClient } from "../core/client.ts";
export { parseInputData, toHex } from "../core/hash.ts";
export { resolveDataInput } from "../core/input.ts";
export { getOrFetchMetadata } from "../core/metadata.ts";
export { BOLD, formatJson, isJsonOutput, printHeading, RESET } from "../core/output.ts";
export { CliError } from "../utils/errors.ts";
export { findClosest } from "../utils/fuzzy-match.ts";
export { readRawOptionValue } from "./cli.ts";

// Entry-point bootstrap (registerGlobalOptions) lives in ./cli.ts and is
// imported directly by entry points (src/cli.ts) — not re-exported here, since
// this barrel is the surface for feature command modules, not for CLI bootstrap.
