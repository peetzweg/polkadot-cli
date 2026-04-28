export interface RuntimeFingerprint {
  specName: string;
  specVersion: number;
  transactionVersion: number;
  implName: string;
  implVersion: number;
  authoringVersion: number;
  // Hex of `state_getStorageHash(":code:")` — changes whenever the runtime
  // wasm changes, even if specVersion was kept the same (e.g. local node
  // restarted with a different runtime). The authoritative staleness signal.
  codeHash: string;
  fetchedAt: string;
}

export function fingerprintsMatch(a: RuntimeFingerprint, b: RuntimeFingerprint): boolean {
  return (
    a.codeHash === b.codeHash &&
    a.specVersion === b.specVersion &&
    a.transactionVersion === b.transactionVersion
  );
}

export function isRuntimeFingerprint(value: unknown): value is RuntimeFingerprint {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.specName === "string" &&
    typeof v.specVersion === "number" &&
    typeof v.transactionVersion === "number" &&
    typeof v.implName === "string" &&
    typeof v.implVersion === "number" &&
    typeof v.authoringVersion === "number" &&
    typeof v.codeHash === "string" &&
    typeof v.fetchedAt === "string"
  );
}
