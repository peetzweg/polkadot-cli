import { sr25519CreateDerive } from "@polkadot-labs/hdkd";
import {
  DEV_PHRASE,
  entropyToMiniSecret,
  generateMnemonic,
  mnemonicToEntropy,
  ss58Address,
  ss58Decode,
  validateMnemonic,
} from "@polkadot-labs/hdkd-helpers";
import type { PolkadotSigner } from "polkadot-api/signer";
import { getPolkadotSigner } from "polkadot-api/signer";
import { findAccount, loadAccounts } from "../config/accounts-store.ts";
import { type EnvSecret, isEnvSecret } from "../config/accounts-types.ts";

export const DEV_NAMES = ["alice", "bob", "charlie", "dave", "eve", "ferdie"] as const;

export function isDevAccount(name: string): boolean {
  return DEV_NAMES.includes(name.toLowerCase() as any);
}

function devDerivationPath(name: string): string {
  return `//${name.charAt(0).toUpperCase()}${name.slice(1).toLowerCase()}`;
}

function deriveFromMnemonic(
  mnemonic: string,
  path: string,
): { publicKey: Uint8Array; sign: (msg: Uint8Array) => Uint8Array } {
  const entropy = mnemonicToEntropy(mnemonic);
  const miniSecret = entropyToMiniSecret(entropy);
  const derive = sr25519CreateDerive(miniSecret);
  return derive(path);
}

function deriveFromHexSeed(
  hexSeed: string,
  path: string,
): { publicKey: Uint8Array; sign: (msg: Uint8Array) => Uint8Array } {
  const clean = hexSeed.startsWith("0x") ? hexSeed.slice(2) : hexSeed;
  const seed = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    seed[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  const derive = sr25519CreateDerive(seed);
  return derive(path);
}

function getDevKeypair(name: string) {
  const path = devDerivationPath(name);
  return deriveFromMnemonic(DEV_PHRASE, path);
}

export function getDevAddress(name: string, prefix = 42): string {
  const keypair = getDevKeypair(name);
  return ss58Address(keypair.publicKey, prefix);
}

export function createNewAccount(path = ""): {
  mnemonic: string;
  publicKey: Uint8Array;
} {
  const mnemonic = generateMnemonic();
  const entropy = mnemonicToEntropy(mnemonic);
  const miniSecret = entropyToMiniSecret(entropy);
  const derive = sr25519CreateDerive(miniSecret);
  const keypair = derive(path);
  return { mnemonic, publicKey: keypair.publicKey };
}

export function importAccount(secret: string, path = ""): { publicKey: Uint8Array } {
  const isHexSeed = /^0x[0-9a-fA-F]{64}$/.test(secret);

  if (isHexSeed) {
    const keypair = deriveFromHexSeed(secret, path);
    return { publicKey: keypair.publicKey };
  }

  if (!validateMnemonic(secret)) {
    throw new Error(
      "Invalid secret. Expected a 0x-prefixed 32-byte hex seed or a valid BIP39 mnemonic.",
    );
  }

  const keypair = deriveFromMnemonic(secret, path);
  return { publicKey: keypair.publicKey };
}

export function publicKeyToHex(publicKey: Uint8Array): string {
  return (
    "0x" +
    Array.from(publicKey)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

export function toSs58(publicKey: Uint8Array | string, prefix = 42): string {
  if (typeof publicKey === "string") {
    const clean = publicKey.startsWith("0x") ? publicKey.slice(2) : publicKey;
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < clean.length; i += 2) {
      bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
    }
    return ss58Address(bytes, prefix);
  }
  return ss58Address(publicKey, prefix);
}

export function fromSs58(address: string): Uint8Array {
  const [payload] = ss58Decode(address);
  return payload;
}

export function isHexPublicKey(input: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(input);
}

export function resolveSecret(secret: string | EnvSecret): string {
  if (isEnvSecret(secret)) {
    const value = process.env[secret.env];
    if (!value) {
      throw new Error(`Environment variable "${secret.env}" is not set. Set it before signing.`);
    }
    return value;
  }
  return secret;
}

export function tryDerivePublicKey(envVarName: string, path = ""): string | null {
  const value = process.env[envVarName];
  if (!value) return null;
  try {
    const { publicKey } = importAccount(value, path);
    return publicKeyToHex(publicKey);
  } catch {
    return null;
  }
}

export async function resolveAccountSigner(name: string): Promise<PolkadotSigner> {
  // Check dev accounts first
  if (isDevAccount(name)) {
    const keypair = getDevKeypair(name);
    return getPolkadotSigner(keypair.publicKey, "Sr25519", keypair.sign);
  }

  // Check stored accounts
  const accountsFile = await loadAccounts();
  const account = findAccount(accountsFile, name);
  if (!account) {
    const available = [...DEV_NAMES, ...accountsFile.accounts.map((a) => a.name)];
    throw new Error(`Unknown account "${name}". Available accounts: ${available.join(", ")}`);
  }

  const secret = resolveSecret(account.secret);
  const isHexSeed = /^0x[0-9a-fA-F]{64}$/.test(secret);
  const keypair = isHexSeed
    ? deriveFromHexSeed(secret, account.derivationPath)
    : deriveFromMnemonic(secret, account.derivationPath);

  return getPolkadotSigner(keypair.publicKey, "Sr25519", keypair.sign);
}
