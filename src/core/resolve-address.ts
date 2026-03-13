import { findAccount, loadAccounts } from "../config/accounts-store.ts";
import {
  DEV_NAMES,
  fromSs58,
  getDevAddress,
  isDevAccount,
  isHexPublicKey,
  publicKeyToHex,
  toSs58,
} from "./accounts.ts";

/**
 * Resolve a CLI input to an SS58 address.
 *
 * Resolution order:
 * 1. Dev account name -> SS58
 * 2. Stored account name -> SS58
 * 3. Valid SS58 -> return as-is
 * 4. Valid hex public key (0x + 64 hex chars) -> return as-is
 * 5. Error
 */
export async function resolveAccountAddress(input: string): Promise<string> {
  // 1. Dev account
  if (isDevAccount(input)) {
    return getDevAddress(input);
  }

  // 2. Stored account
  const accountsFile = await loadAccounts();
  const account = findAccount(accountsFile, input);
  if (account) {
    if (account.publicKey) {
      return toSs58(account.publicKey);
    }
    throw new Error(`Account "${account.name}" has no public key resolved yet.`);
  }

  // 3. Valid SS58
  try {
    const decoded = fromSs58(input);
    // If decoding succeeds, re-encode to normalize
    publicKeyToHex(decoded); // validates length
    return input;
  } catch {
    // not SS58
  }

  // 4. Hex public key
  if (isHexPublicKey(input)) {
    return input;
  }

  // 5. Error
  const stored = accountsFile.accounts.map((a) => a.name);
  const available = [...DEV_NAMES, ...stored];
  throw new Error(
    `Unknown account or address "${input}".\n  Available accounts: ${available.join(", ")}`,
  );
}
