import type { CAC } from "cac";
import { findAccount, loadAccounts, saveAccounts } from "../config/accounts-store.ts";
import { isEnvSecret } from "../config/accounts-types.ts";
import {
  createNewAccount,
  DEV_NAMES,
  getDevAddress,
  importAccount,
  isDevAccount,
  publicKeyToHex,
  toSs58,
  tryDerivePublicKey,
} from "../core/accounts.ts";
import { BOLD, printHeading, printItem, RESET, YELLOW } from "../core/output.ts";

const ACCOUNT_HELP = `
${BOLD}Usage:${RESET}
  $ dot account create <name>                Create a new account
  $ dot account import <name> --secret <s>   Import from BIP39 mnemonic
  $ dot account add <name> --env <VAR>       Add account backed by env variable
  $ dot account list                         List all accounts
  $ dot account remove <name>                Remove a stored account

${BOLD}Examples:${RESET}
  $ dot account create my-validator
  $ dot account import treasury --secret "word1 word2 ... word12"
  $ dot account add ci-signer --env MY_SECRET
  $ dot account list
  $ dot account remove my-validator

${YELLOW}Note: Secrets are stored unencrypted in ~/.polkadot/accounts.json.
      Use --env to keep secrets off disk entirely.
      Hex seed import (0x...) is not supported via CLI.${RESET}
`.trimStart();

export function registerAccountCommands(cli: CAC) {
  cli
    .command("account [action] [name]", "Manage local accounts (create, import, add, list, remove)")
    .alias("accounts")
    .option("--secret <value>", "Secret key (mnemonic or hex seed) for import")
    .option("--env <varName>", "Environment variable name holding the secret")
    .action(
      async (
        action: string | undefined,
        name: string | undefined,
        opts: { secret?: string; env?: string },
      ) => {
        if (!action) {
          return accountList();
        }
        switch (action) {
          case "create":
            return accountCreate(name);
          case "import":
            return accountImport(name, opts);
          case "add":
            return accountAdd(name, opts);
          case "list":
            return accountList();
          case "remove":
            return accountRemove(name);
          default:
            console.error(`Unknown action "${action}".\n`);
            console.log(ACCOUNT_HELP);
            process.exit(1);
        }
      },
    );
}

async function accountCreate(name: string | undefined) {
  if (!name) {
    console.error("Account name is required.\n");
    console.error("Usage: dot account create <name>");
    process.exit(1);
  }

  if (isDevAccount(name)) {
    throw new Error(
      `"${name}" is a built-in dev account and cannot be used as a custom account name.`,
    );
  }

  const accountsFile = await loadAccounts();
  if (findAccount(accountsFile, name)) {
    throw new Error(`Account "${name}" already exists.`);
  }

  const { mnemonic, publicKey } = createNewAccount();
  const hexPub = publicKeyToHex(publicKey);
  const address = toSs58(publicKey);

  accountsFile.accounts.push({
    name,
    secret: mnemonic,
    publicKey: hexPub,
    derivationPath: "",
  });
  await saveAccounts(accountsFile);

  printHeading("Account Created");
  console.log(`  ${BOLD}Name:${RESET}     ${name}`);
  console.log(`  ${BOLD}Address:${RESET}  ${address}`);
  console.log(`  ${BOLD}Mnemonic:${RESET} ${mnemonic}`);
  console.log();
  console.log(
    `  ${YELLOW}Save this mnemonic phrase! It is the only way to recover this account.${RESET}`,
  );
  console.log();
}

async function accountImport(name: string | undefined, opts: { secret?: string }) {
  if (!name) {
    console.error("Account name is required.\n");
    console.error('Usage: dot account import <name> --secret "mnemonic or hex seed"');
    process.exit(1);
  }

  if (!opts.secret) {
    console.error("--secret is required.\n");
    console.error('Usage: dot account import <name> --secret "mnemonic or hex seed"');
    process.exit(1);
  }

  if (isDevAccount(name)) {
    throw new Error(
      `"${name}" is a built-in dev account and cannot be used as a custom account name.`,
    );
  }

  const accountsFile = await loadAccounts();
  if (findAccount(accountsFile, name)) {
    throw new Error(`Account "${name}" already exists.`);
  }

  const { publicKey } = importAccount(opts.secret);
  const hexPub = publicKeyToHex(publicKey);
  const address = toSs58(publicKey);

  accountsFile.accounts.push({
    name,
    secret: opts.secret,
    publicKey: hexPub,
    derivationPath: "",
  });
  await saveAccounts(accountsFile);

  printHeading("Account Imported");
  console.log(`  ${BOLD}Name:${RESET}    ${name}`);
  console.log(`  ${BOLD}Address:${RESET} ${address}`);
  console.log();
}

async function accountAdd(name: string | undefined, opts: { env?: string }) {
  if (!name) {
    console.error("Account name is required.\n");
    console.error("Usage: dot account add <name> --env <VAR>");
    process.exit(1);
  }

  if (!opts.env) {
    console.error("--env is required.\n");
    console.error("Usage: dot account add <name> --env <VAR>");
    process.exit(1);
  }

  if (isDevAccount(name)) {
    throw new Error(
      `"${name}" is a built-in dev account and cannot be used as a custom account name.`,
    );
  }

  const accountsFile = await loadAccounts();
  if (findAccount(accountsFile, name)) {
    throw new Error(`Account "${name}" already exists.`);
  }

  const publicKey = tryDerivePublicKey(opts.env) ?? "";

  accountsFile.accounts.push({
    name,
    secret: { env: opts.env },
    publicKey,
    derivationPath: "",
  });
  await saveAccounts(accountsFile);

  printHeading("Account Added");
  console.log(`  ${BOLD}Name:${RESET}  ${name}`);
  console.log(`  ${BOLD}Env:${RESET}   ${opts.env}`);
  if (publicKey) {
    console.log(`  ${BOLD}Address:${RESET} ${toSs58(publicKey)}`);
  } else {
    console.log(`  ${YELLOW}Address will resolve when $${opts.env} is set.${RESET}`);
  }
  console.log();
}

async function accountList() {
  printHeading("Dev Accounts");
  for (const name of DEV_NAMES) {
    const display = name.charAt(0).toUpperCase() + name.slice(1);
    const address = getDevAddress(name);
    printItem(display, address);
  }

  const accountsFile = await loadAccounts();
  if (accountsFile.accounts.length > 0) {
    printHeading("Stored Accounts");
    for (const account of accountsFile.accounts) {
      let displayName = account.name;
      let address: string;

      if (isEnvSecret(account.secret)) {
        displayName += ` (env: ${account.secret.env})`;
        let pubKey = account.publicKey;
        if (!pubKey) {
          pubKey = tryDerivePublicKey(account.secret.env) ?? "";
        }
        address = pubKey ? toSs58(pubKey) : "n/a";
      } else {
        address = toSs58(account.publicKey);
      }

      printItem(displayName, address);
    }
  } else {
    printHeading("Stored Accounts");
    console.log("  (none)");
  }
  console.log();
}

async function accountRemove(name: string | undefined) {
  if (!name) {
    console.error("Account name is required.\n");
    console.error("Usage: dot account remove <name>");
    process.exit(1);
  }

  if (isDevAccount(name)) {
    throw new Error("Cannot remove built-in dev accounts.");
  }

  const accountsFile = await loadAccounts();
  const idx = accountsFile.accounts.findIndex((a) => a.name.toLowerCase() === name.toLowerCase());
  if (idx === -1) {
    throw new Error(`Account "${name}" not found.`);
  }

  accountsFile.accounts.splice(idx, 1);
  await saveAccounts(accountsFile);
  console.log(`Account "${name}" removed.`);
}
