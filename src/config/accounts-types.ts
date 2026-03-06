export interface EnvSecret {
  env: string; // environment variable name holding the secret
}

export function isEnvSecret(secret: string | EnvSecret): secret is EnvSecret {
  return typeof secret === "object" && secret !== null && "env" in secret;
}

export interface StoredAccount {
  name: string;
  secret: string | EnvSecret; // hex mini-secret (0x...), BIP39 mnemonic, or env var reference
  publicKey: string; // hex 0x-prefixed, 32 bytes (may be "" for deferred env accounts)
  derivationPath: string; // "" for root
}

export interface AccountsFile {
  accounts: StoredAccount[];
}
