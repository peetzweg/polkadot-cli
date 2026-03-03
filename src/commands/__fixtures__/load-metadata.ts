import { parseMetadata } from "../../core/metadata.ts";
import type { MetadataBundle } from "../../core/metadata.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";

let cached: MetadataBundle | null = null;

export function getTestMetadata(): MetadataBundle {
  if (!cached) {
    const raw = readFileSync(join(import.meta.dir, "polkadot-metadata.bin"));
    cached = parseMetadata(new Uint8Array(raw));
  }
  return cached;
}
