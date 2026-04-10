import { readFile } from "node:fs/promises";
import type { CAC } from "cac";
import { resolveAccountKeypair } from "../core/accounts.ts";
import { parseInputData, toHex } from "../core/hash.ts";
import { BOLD, CYAN, DIM, isJsonOutput, printResult, RESET } from "../core/output.ts";
import { CliError } from "../utils/errors.ts";

const SUPPORTED_TYPES = ["sr25519"] as const;
type SignatureType = (typeof SUPPORTED_TYPES)[number];

function isSupportedType(type: string): type is SignatureType {
  return SUPPORTED_TYPES.includes(type.toLowerCase() as SignatureType);
}

function variantName(type: SignatureType): string {
  switch (type) {
    case "sr25519":
      return "Sr25519";
  }
}

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
    const buf = await readFile(opts.file);
    return new Uint8Array(buf);
  }

  if (opts.stdin) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    return new Uint8Array(Buffer.concat(chunks));
  }

  return parseInputData(data!);
}

function printSignHelp(): void {
  console.log(`${BOLD}Usage:${RESET} dot sign <message> --from <account> [options]\n`);
  console.log(`${BOLD}Arguments:${RESET}`);
  console.log(
    `  ${CYAN}message${RESET}          ${DIM}Message to sign (text or 0x-prefixed hex)${RESET}`,
  );
  console.log(`\n${BOLD}Options:${RESET}`);
  console.log(`  ${CYAN}--from <name>${RESET}    ${DIM}Account to sign with (required)${RESET}`);
  console.log(`  ${CYAN}--type <algo>${RESET}    ${DIM}Signature type: sr25519 (default)${RESET}`);
  console.log(`  ${CYAN}--file <path>${RESET}    ${DIM}Sign file contents${RESET}`);
  console.log(`  ${CYAN}--stdin${RESET}           ${DIM}Read from stdin${RESET}`);
  console.log(`  ${CYAN}--output json${RESET}    ${DIM}Output as JSON${RESET}`);
  console.log(`\n${BOLD}Examples:${RESET}`);
  console.log(`  ${DIM}$ dot sign "hello world" --from alice${RESET}`);
  console.log(`  ${DIM}$ dot sign 0xdeadbeef --from alice${RESET}`);
  console.log(`  ${DIM}$ dot sign --file ./payload.bin --from alice${RESET}`);
  console.log(`  ${DIM}$ echo -n "hello" | dot sign --stdin --from alice${RESET}`);
  console.log(`  ${DIM}$ dot sign "hello" --from alice --output json${RESET}`);
}

export function registerSignCommand(cli: CAC) {
  cli
    .command("sign [message]", "Sign a message with an account keypair")
    .option("--from <name>", "Account to sign with")
    .option("--type <algo>", "Signature type (default: sr25519)")
    .option("--file <path>", "Sign file contents (raw bytes)")
    .option("--stdin", "Read data from stdin")
    .action(
      async (
        message: string | undefined,
        opts: {
          from?: string;
          type?: string;
          file?: string;
          stdin?: boolean;
          output?: string;
          json?: boolean;
        },
      ) => {
        if (!message && !opts.file && !opts.stdin) {
          printSignHelp();
          return;
        }

        if (!opts.from) {
          throw new CliError("--from is required. Specify the account to sign with.");
        }

        const type: SignatureType = (opts.type?.toLowerCase() ?? "sr25519") as SignatureType;
        if (!isSupportedType(type)) {
          throw new CliError(
            `Unsupported signature type "${opts.type}". Supported: ${SUPPORTED_TYPES.join(", ")}`,
          );
        }

        const input = await resolveInput(message, opts);
        const keypair = await resolveAccountKeypair(opts.from);
        const signature = keypair.sign(input);
        const hexMessage = toHex(input);
        const hexSignature = toHex(signature);
        const variant = variantName(type);
        const enumValue = `${variant}(${hexSignature})`;

        const result = {
          type: variant,
          message: hexMessage,
          signature: hexSignature,
          enum: enumValue,
        };

        if (isJsonOutput(opts)) {
          printResult(result, "json");
        } else {
          console.log(`  ${BOLD}Type:${RESET}       ${result.type}`);
          console.log(`  ${BOLD}Message:${RESET}    ${result.message}`);
          console.log(`  ${BOLD}Signature:${RESET}  ${result.signature}`);
          console.log(`  ${BOLD}Enum:${RESET}       ${result.enum}`);
        }
      },
    );
}
