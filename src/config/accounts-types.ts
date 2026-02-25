export interface StoredAccount {
  name: string;
  secret: string; // hex mini-secret (0x...) or BIP39 mnemonic
  publicKey: string; // hex 0x-prefixed, 32 bytes
  derivationPath: string; // "" for root
}

export interface AccountsFile {
  accounts: StoredAccount[];
}
