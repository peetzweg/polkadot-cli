import type { CAC } from "cac";
import { resolveAccountKeypair } from "../core/accounts.ts";
import { toHex } from "../core/hash.ts";
import { resolveDataInput } from "../core/input.ts";
import { BOLD, CYAN, DIM, isJsonOutput, printResult, RESET } from "../core/output.ts";
import { withHelp } from "../platform/cli.ts";
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
  const command = cli
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

        const input = await resolveDataInput(message, opts);
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
  withHelp(command, printSignHelp);
}
