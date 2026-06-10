import type { CAC } from "cac";
import {
  ALGORITHMS,
  computeHash,
  getAlgorithmNames,
  isValidAlgorithm,
  toHex,
} from "../core/hash.ts";
import { resolveDataInput } from "../core/input.ts";
import { BOLD, CYAN, DIM, isJsonOutput, printResult, RESET } from "../core/output.ts";
import { CliError } from "../utils/errors.ts";
import { suggestMessage } from "../utils/fuzzy-match.ts";

function printAlgorithmHelp(): void {
  console.log(`${BOLD}Usage:${RESET} dot hash <algorithm> <data> [options]\n`);
  console.log(`${BOLD}Algorithms:${RESET}`);
  for (const [name, algo] of Object.entries(ALGORITHMS)) {
    console.log(
      `  ${CYAN}${name}${RESET}  ${DIM}${algo.description} (${algo.outputLen} bytes)${RESET}`,
    );
  }
  console.log(`\n${BOLD}Options:${RESET}`);
  console.log(`  ${CYAN}--file <path>${RESET}   ${DIM}Hash file contents${RESET}`);
  console.log(`  ${CYAN}--stdin${RESET}          ${DIM}Read from stdin${RESET}`);
  console.log(`  ${CYAN}--output json${RESET}    ${DIM}Output as JSON${RESET}`);
  console.log(`\n${BOLD}Examples:${RESET}`);
  console.log(`  ${DIM}$ dot hash blake2b256 0xdeadbeef${RESET}`);
  console.log(`  ${DIM}$ dot hash sha256 hello${RESET}`);
  console.log(`  ${DIM}$ dot hash keccak256 --file ./data.bin${RESET}`);
  console.log(`  ${DIM}$ echo -n "hello" | dot hash sha256 --stdin${RESET}`);
}

export function registerHashCommand(cli: CAC) {
  cli
    .command("hash [algorithm] [data]", "Compute cryptographic hashes")
    .option("--file <path>", "Hash file contents (raw bytes)")
    .option("--stdin", "Read data from stdin")
    .action(
      async (
        algorithm: string | undefined,
        data: string | undefined,
        opts: { file?: string; stdin?: boolean; output?: string; json?: boolean },
      ) => {
        if (!algorithm) {
          printAlgorithmHelp();
          return;
        }

        if (!isValidAlgorithm(algorithm)) {
          throw new CliError(suggestMessage("algorithm", algorithm, getAlgorithmNames()));
        }

        const input = await resolveDataInput(data, opts);
        const hash = computeHash(algorithm, input);
        const hexHash = toHex(hash);

        if (isJsonOutput(opts)) {
          printResult(
            {
              algorithm,
              input: data ?? (opts.file ? `file:${opts.file}` : "stdin"),
              hash: hexHash,
            },
            "json",
          );
        } else {
          console.log(hexHash);
        }
      },
    );
}
