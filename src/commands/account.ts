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
  $ dot account create|new <name> [--path <derivation>]              Create a new account
  $ dot account import|add <name> --secret <s> [--path <derivation>] Import from BIP39 mnemonic
  $ dot account import|add <name> --env <VAR> [--path <derivation>]  Import account backed by env variable
  $ dot account derive <source> <new-name> --path <derivation>       Derive a child account
  $ dot account list                                                 List all accounts
  $ dot account remove|delete <name> [name2] ...                     Remove stored account(s)

${BOLD}Examples:${RESET}
  $ dot account create my-validator
  $ dot account create my-staking --path //staking
  $ dot account create multi --path //polkadot//0/wallet
  $ dot account import treasury --secret "word1 word2 ... word12"
  $ dot account import ci-signer --env MY_SECRET --path //ci
  $ dot account derive treasury treasury-staking --path //staking
  $ dot account list
  $ dot account remove my-validator stale-key

${YELLOW}Note: Secrets are stored unencrypted in ~/.polkadot/accounts.json.
      Use --env to keep secrets off disk entirely.
      Hex seed import (0x...) is not supported via CLI.${RESET}
`.trimStart();

export function registerAccountCommands(cli: CAC) {
  cli
    .command("account [action] [...names]", "Manage local accounts (create, import, list, remove)")
    .alias("accounts")
    .option("--secret <value>", "Secret key (mnemonic or hex seed) for import")
    .option("--env <varName>", "Environment variable name holding the secret")
    .option("--path <derivation>", "Derivation path (e.g. //staking, //polkadot//0/wallet)")
    .action(
      async (
        action: string | undefined,
        names: string[],
        opts: { secret?: string; env?: string; path?: string },
      ) => {
        if (!action) {
          if (process.argv[2] === "accounts") return accountList();
          console.log(ACCOUNT_HELP);
          return;
        }
        switch (action) {
          case "new":
          case "create":
            return accountCreate(names[0], opts);
          case "import":
          case "add":
            return accountImport(names[0], opts);
          case "derive":
            return accountDerive(names[0], names[1], opts);
          case "list":
            return accountList();
          case "delete":
          case "remove":
            return accountRemove(names);
          default:
            console.error(`Unknown action "${action}".\n`);
            console.log(ACCOUNT_HELP);
            process.exit(1);
        }
      },
    );
}

async function accountCreate(name: string | undefined, opts: { path?: string }) {
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

  const path = opts.path ?? "";
  const { mnemonic, publicKey } = createNewAccount(path);
  const hexPub = publicKeyToHex(publicKey);
  const address = toSs58(publicKey);

  accountsFile.accounts.push({
    name,
    secret: mnemonic,
    publicKey: hexPub,
    derivationPath: path,
  });
  await saveAccounts(accountsFile);

  printHeading("Account Created");
  console.log(`  ${BOLD}Name:${RESET}     ${name}`);
  if (path) console.log(`  ${BOLD}Path:${RESET}     ${path}`);
  console.log(`  ${BOLD}Address:${RESET}  ${address}`);
  console.log(`  ${BOLD}Mnemonic:${RESET} ${mnemonic}`);
  console.log();
  console.log(
    `  ${YELLOW}Save this mnemonic phrase! It is the only way to recover this account.${RESET}`,
  );
  console.log();
}

async function accountImport(
  name: string | undefined,
  opts: { secret?: string; env?: string; path?: string },
) {
  if (!name) {
    console.error("Account name is required.\n");
    console.error('Usage: dot account import <name> --secret "mnemonic or hex seed"');
    process.exit(1);
  }

  if (opts.secret && opts.env) {
    console.error("Use --secret or --env, not both.\n");
    process.exit(1);
  }

  if (!opts.secret && !opts.env) {
    console.error("--secret or --env is required.\n");
    console.error('Usage: dot account import <name> --secret "mnemonic or hex seed"');
    console.error("       dot account import <name> --env <VAR>");
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

  const path = opts.path ?? "";

  if (opts.env) {
    const publicKey = tryDerivePublicKey(opts.env, path) ?? "";

    accountsFile.accounts.push({
      name,
      secret: { env: opts.env },
      publicKey,
      derivationPath: path,
    });
    await saveAccounts(accountsFile);

    printHeading("Account Imported");
    console.log(`  ${BOLD}Name:${RESET}    ${name}`);
    if (path) console.log(`  ${BOLD}Path:${RESET}    ${path}`);
    console.log(`  ${BOLD}Env:${RESET}     ${opts.env}`);
    if (publicKey) {
      console.log(`  ${BOLD}Address:${RESET} ${toSs58(publicKey)}`);
    } else {
      console.log(`  ${YELLOW}Address will resolve when $${opts.env} is set.${RESET}`);
    }
    console.log();
  } else {
    const { publicKey } = importAccount(opts.secret!, path);
    const hexPub = publicKeyToHex(publicKey);
    const address = toSs58(publicKey);

    accountsFile.accounts.push({
      name,
      secret: opts.secret!,
      publicKey: hexPub,
      derivationPath: path,
    });
    await saveAccounts(accountsFile);

    printHeading("Account Imported");
    console.log(`  ${BOLD}Name:${RESET}    ${name}`);
    if (path) console.log(`  ${BOLD}Path:${RESET}    ${path}`);
    console.log(`  ${BOLD}Address:${RESET} ${address}`);
    console.log();
  }
}

async function accountDerive(
  sourceName: string | undefined,
  newName: string | undefined,
  opts: { path?: string },
) {
  if (!sourceName) {
    console.error("Source account name is required.\n");
    console.error("Usage: dot account derive <source> <new-name> --path <derivation>");
    process.exit(1);
  }

  if (!newName) {
    console.error("New account name is required.\n");
    console.error("Usage: dot account derive <source> <new-name> --path <derivation>");
    process.exit(1);
  }

  if (!opts.path) {
    console.error("--path is required for derive.\n");
    console.error("Usage: dot account derive <source> <new-name> --path <derivation>");
    process.exit(1);
  }

  if (isDevAccount(newName)) {
    throw new Error(
      `"${newName}" is a built-in dev account and cannot be used as a custom account name.`,
    );
  }

  const accountsFile = await loadAccounts();

  const source = findAccount(accountsFile, sourceName);
  if (!source) {
    throw new Error(`Source account "${sourceName}" not found.`);
  }

  if (findAccount(accountsFile, newName)) {
    throw new Error(`Account "${newName}" already exists.`);
  }

  const path = opts.path;

  if (isEnvSecret(source.secret)) {
    const publicKey = tryDerivePublicKey(source.secret.env, path) ?? "";

    accountsFile.accounts.push({
      name: newName,
      secret: source.secret,
      publicKey,
      derivationPath: path,
    });
    await saveAccounts(accountsFile);

    printHeading("Account Derived");
    console.log(`  ${BOLD}Name:${RESET}    ${newName}`);
    console.log(`  ${BOLD}Source:${RESET}  ${sourceName}`);
    console.log(`  ${BOLD}Path:${RESET}    ${path}`);
    console.log(`  ${BOLD}Env:${RESET}     ${source.secret.env}`);
    if (publicKey) {
      console.log(`  ${BOLD}Address:${RESET} ${toSs58(publicKey)}`);
    } else {
      console.log(`  ${YELLOW}Address will resolve when $${source.secret.env} is set.${RESET}`);
    }
    console.log();
  } else {
    const { publicKey } = importAccount(source.secret, path);
    const hexPub = publicKeyToHex(publicKey);
    const address = toSs58(publicKey);

    accountsFile.accounts.push({
      name: newName,
      secret: source.secret,
      publicKey: hexPub,
      derivationPath: path,
    });
    await saveAccounts(accountsFile);

    printHeading("Account Derived");
    console.log(`  ${BOLD}Name:${RESET}    ${newName}`);
    console.log(`  ${BOLD}Source:${RESET}  ${sourceName}`);
    console.log(`  ${BOLD}Path:${RESET}    ${path}`);
    console.log(`  ${BOLD}Address:${RESET} ${address}`);
    console.log();
  }
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
      if (account.derivationPath) {
        displayName += ` (${account.derivationPath})`;
      }
      let address: string;

      if (isEnvSecret(account.secret)) {
        displayName += ` (env: ${account.secret.env})`;
        let pubKey = account.publicKey;
        if (!pubKey) {
          pubKey = tryDerivePublicKey(account.secret.env, account.derivationPath) ?? "";
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

async function accountRemove(names: string[]) {
  if (names.length === 0) {
    console.error("At least one account name is required.\n");
    console.error("Usage: dot account remove <name> [name2] ...");
    process.exit(1);
  }

  // Validate all names upfront before deleting anything
  const errors: string[] = [];
  for (const name of names) {
    if (isDevAccount(name)) {
      errors.push(`Cannot remove built-in dev account "${name}".`);
    }
  }
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  const accountsFile = await loadAccounts();
  const indicesToRemove = new Set<number>();
  for (const name of names) {
    const idx = accountsFile.accounts.findIndex((a) => a.name.toLowerCase() === name.toLowerCase());
    if (idx === -1) {
      errors.push(`Account "${name}" not found.`);
    } else {
      indicesToRemove.add(idx);
    }
  }
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  // Remove in reverse order to avoid index shifting
  for (const idx of [...indicesToRemove].sort((a, b) => b - a)) {
    accountsFile.accounts.splice(idx, 1);
  }
  await saveAccounts(accountsFile);

  for (const name of names) {
    console.log(`Account "${name}" removed.`);
  }
}
