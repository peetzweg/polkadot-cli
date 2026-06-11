import { readFile } from "node:fs/promises";
import { CliError } from "../utils/errors.ts";
import { parseInputData } from "./hash.ts";

/**
 * Resolve a command's data input from exactly one of: an inline value (text or
 * 0x hex), `--file <path>` (raw bytes), or `--stdin`. The error wording is
 * overridable so each command can name its own inline source (positional
 * argument vs `--message`).
 */
export async function resolveDataInput(
  inline: string | undefined,
  opts: { file?: string; stdin?: boolean },
  messages?: { conflict?: string; missing?: string },
): Promise<Uint8Array> {
  const sources = [inline !== undefined, !!opts.file, !!opts.stdin].filter(Boolean).length;
  if (sources > 1) {
    throw new CliError(
      messages?.conflict ?? "Provide only one of: inline data, --file, or --stdin",
    );
  }
  if (sources === 0) {
    throw new CliError(
      messages?.missing ?? "No input provided. Pass data as argument, or use --file or --stdin",
    );
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

  return parseInputData(inline!);
}
