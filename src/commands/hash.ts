import type { CAC } from "cac";
import {
  ALGORITHMS,
  computeHash,
  getAlgorithmNames,
  isValidAlgorithm,
  parseInputData,
  toHex,
} from "../core/hash.ts";
import { printResult, BOLD, CYAN, DIM, RESET } from "../core/output.ts";
import { suggestMessage } from "../utils/fuzzy-match.ts";
import { CliError } from "../utils/errors.ts";

async function resolveInput(
  data: string | undefined,
  opts: { file?: string; stdin?: boolean },
): Promise<Uint8Array> {
  const sources = [data !== undefined, !!opts.file, !!opts.stdin].filter(Boolean).length;
  if (sources > 1) {
    throw new CliError("Provide only one of: inline data, --file, or --stdin");
  }
  if (sources === 0) {
    throw new CliError("No input provided. Pass data as argument, or use --file or --stdin");
  }

  if (opts.file) {
    const buf = await Bun.file(opts.file).arrayBuffer();
    return new Uint8Array(buf);
  }

  if (opts.stdin) {
    const reader = Bun.stdin.stream().getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
    const result = new Uint8Array(totalLen);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }

  return parseInputData(data!);
}

function printAlgorithmHelp(): void {
  console.log(`${BOLD}Usage:${RESET} dot hash <algorithm> <data> [options]\n`);
  console.log(`${BOLD}Algorithms:${RESET}`);
  for (const [name, algo] of Object.entries(ALGORITHMS)) {
    console.log(`  ${CYAN}${name}${RESET}  ${DIM}${algo.description} (${algo.outputLen} bytes)${RESET}`);
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
        opts: { file?: string; stdin?: boolean; output?: string },
      ) => {
        if (!algorithm) {
          printAlgorithmHelp();
          return;
        }

        if (!isValidAlgorithm(algorithm)) {
          throw new CliError(
            suggestMessage("algorithm", algorithm, getAlgorithmNames()),
          );
        }

        const input = await resolveInput(data, opts);
        const hash = computeHash(algorithm, input);
        const hexHash = toHex(hash);

        const format = opts.output ?? "pretty";
        if (format === "json") {
          printResult({ algorithm, input: data ?? (opts.file ? `file:${opts.file}` : "stdin"), hash: hexHash }, "json");
        } else {
          console.log(hexHash);
        }
      },
    );
}
