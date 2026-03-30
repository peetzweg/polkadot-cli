import type { CAC } from "cac";
import { findAccount, loadAccounts, saveAccounts } from "../config/accounts-store.ts";
import { isWatchOnly } from "../config/accounts-types.ts";
import {
  DEV_NAMES,
  isDevAccount,
  isHexPublicKey,
  publicKeyToHex,
  resolveSecret,
} from "../core/accounts.ts";
import { deriveBandersnatchMember } from "../core/bandersnatch.ts";
import { BOLD, formatJson, printHeading, RESET } from "../core/output.ts";

const DEV_PHRASE = "bottom drive obey lake curtain smoke basket hold race lonely fit walk";

const VERIFIABLE_HELP = `
${BOLD}Usage:${RESET}
  $ dot verifiable <account> [key]     Derive Bandersnatch member key from account mnemonic

${BOLD}Arguments:${RESET}
  account    Account name (stored or dev account)
  key        Optional blake2b key for keyed derivation (e.g. "candidate")

${BOLD}Examples:${RESET}
  $ dot verifiable alice                        Unkeyed derivation (lite person)
  $ dot verifiable alice candidate              Keyed with "candidate" (full person)
  $ dot verifiable my-account candidate

${BOLD}How it works:${RESET}

  Mnemonic (12/24 words)
      │  mnemonicToEntropy()  (raw BIP39 entropy, NOT miniSecret)
      ▼
  blake2b256(entropy, key?)   keyed or unkeyed
      ▼
  member_from_entropy()       verifiablejs WASM (Bandersnatch curve)
      ▼
  32-byte member key          for on-chain member set registration
`.trimStart();

export function registerVerifiableCommands(cli: CAC) {
  cli
    .command("verifiable [account] [key]", "Derive Bandersnatch member key from account mnemonic")
    .action(
      async (account: string | undefined, key: string | undefined, opts: { output?: string }) => {
        if (!account) {
          console.log(VERIFIABLE_HELP);
          return;
        }
        return deriveVerifiable(account, key, opts);
      },
    );
}

async function deriveVerifiable(
  account: string,
  key: string | undefined,
  opts: { output?: string },
) {
  const mnemonic = await resolveMnemonic(account);
  const memberKey = deriveBandersnatchMember(mnemonic, key);
  const memberKeyHex = publicKeyToHex(memberKey);

  // Save to account store (skip dev accounts — they have no stored entry)
  if (!isDevAccount(account)) {
    const accountsFile = await loadAccounts();
    const stored = findAccount(accountsFile, account);
    if (stored) {
      if (!stored.bandersnatch) stored.bandersnatch = {};
      stored.bandersnatch[key ?? ""] = memberKeyHex;
      await saveAccounts(accountsFile);
    }
  }

  if (opts.output === "json") {
    const result: Record<string, unknown> = {
      account,
      memberKey: memberKeyHex,
    };
    if (key) result.key = key;
    console.log(formatJson(result));
  } else {
    printHeading("Bandersnatch Member Key");
    console.log(`  ${BOLD}Account:${RESET}    ${account}`);
    if (key) console.log(`  ${BOLD}Key:${RESET}        ${key}`);
    console.log(`  ${BOLD}Member Key:${RESET} ${memberKeyHex}`);
    console.log();
  }
}

async function resolveMnemonic(account: string): Promise<string> {
  if (isDevAccount(account)) {
    return DEV_PHRASE;
  }

  const accountsFile = await loadAccounts();
  const stored = findAccount(accountsFile, account);
  if (!stored) {
    const available = [...DEV_NAMES, ...accountsFile.accounts.map((a) => a.name)];
    throw new Error(`Unknown account "${account}". Available accounts: ${available.join(", ")}`);
  }

  if (isWatchOnly(stored)) {
    throw new Error(
      `Account "${account}" is watch-only (no secret). Cannot derive Bandersnatch key.`,
    );
  }

  const secret = resolveSecret(stored.secret!);

  if (isHexPublicKey(`0x${secret.replace(/^0x/, "")}`)) {
    throw new Error(
      `Account "${account}" uses a hex seed. Bandersnatch derivation requires a BIP39 mnemonic.`,
    );
  }

  return secret;
}
