import type { CAC } from "cac";
import { publicKeyToHex, toSs58 } from "../core/accounts.ts";
import { BOLD, CYAN, DIM, formatJson, isJsonOutput, printHeading, RESET } from "../core/output.ts";
import {
  deriveSovereignAccount,
  isValidParaId,
  SOVEREIGN_ACCOUNT_TYPES,
  type SovereignAccountType,
} from "../core/parachain.ts";
import { CliError } from "../utils/errors.ts";

function printParachainHelp(): void {
  console.log(`${BOLD}Usage:${RESET} dot parachain <paraId> [options]\n`);
  console.log(`${BOLD}Description:${RESET}`);
  console.log(`  Derive sovereign account addresses for a parachain.\n`);
  console.log(`  ${DIM}Child accounts represent a parachain on the relay chain.${RESET}`);
  console.log(`  ${DIM}Sibling accounts represent a parachain on another parachain.${RESET}\n`);
  console.log(`${BOLD}Options:${RESET}`);
  console.log(
    `  ${CYAN}--type <child|sibling>${RESET}  ${DIM}Account type (default: both)${RESET}`,
  );
  console.log(`  ${CYAN}--prefix <N>${RESET}             ${DIM}SS58 prefix (default: 42)${RESET}`);
  console.log(`  ${CYAN}--output json${RESET}            ${DIM}Output as JSON${RESET}`);
  console.log(`\n${BOLD}Examples:${RESET}`);
  console.log(`  ${DIM}$ dot parachain 1000${RESET}`);
  console.log(`  ${DIM}$ dot parachain 2004 --prefix 0${RESET}`);
  console.log(`  ${DIM}$ dot parachain 1000 --type sibling${RESET}`);
  console.log(`  ${DIM}$ dot parachain 2000 --output json${RESET}`);
}

function validateType(type: string): SovereignAccountType {
  const lower = type.toLowerCase();
  if (lower === "child" || lower === "sibling") return lower;
  throw new CliError(`Unknown account type "${type}". Valid types: child, sibling.`);
}

export function registerParachainCommand(cli: CAC) {
  cli
    .command("parachain [paraId]", "Derive parachain sovereign accounts")
    .option("--type <type>", "Account type: child, sibling (default: both)")
    .option("--prefix <number>", "SS58 prefix for address encoding (default: 42)")
    .action(
      async (
        paraIdStr: string | undefined,
        opts: { type?: string; prefix?: string; output?: string; json?: boolean },
      ) => {
        if (!paraIdStr) {
          printParachainHelp();
          return;
        }

        const paraId = Number(paraIdStr);
        if (!isValidParaId(paraId)) {
          throw new CliError(
            `Invalid parachain ID "${paraIdStr}". Must be a non-negative integer (0 to 4294967295).`,
          );
        }

        const prefix = opts.prefix != null ? Number(opts.prefix) : 42;
        if (Number.isNaN(prefix) || prefix < 0) {
          throw new CliError(`Invalid prefix "${opts.prefix}". Must be a non-negative integer.`);
        }

        const types: SovereignAccountType[] = opts.type
          ? [validateType(opts.type)]
          : SOVEREIGN_ACCOUNT_TYPES;

        if (isJsonOutput(opts)) {
          const result: Record<string, unknown> = { paraId, prefix };
          for (const type of types) {
            const accountId = deriveSovereignAccount(paraId, type);
            result[type] = {
              publicKey: publicKeyToHex(accountId),
              ss58: toSs58(accountId, prefix),
            };
          }
          console.log(formatJson(result));
        } else {
          printHeading(`Parachain ${paraId} — Sovereign Accounts`);
          for (const type of types) {
            const accountId = deriveSovereignAccount(paraId, type);
            const hex = publicKeyToHex(accountId);
            const ss58 = toSs58(accountId, prefix);
            const label = type.charAt(0).toUpperCase() + type.slice(1);
            console.log(`  ${BOLD}${label}:${RESET}`);
            console.log(`    ${BOLD}Public Key:${RESET}  ${hex}`);
            console.log(`    ${BOLD}SS58:${RESET}        ${ss58}`);
            console.log(`    ${BOLD}Prefix:${RESET}      ${prefix}`);
            console.log();
          }
        }
      },
    );
}
