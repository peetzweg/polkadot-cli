import { readFile, writeFile } from "node:fs/promises";
import type { CAC } from "cac";
import { findAccount, loadAccounts, saveAccounts } from "../config/accounts-store.ts";
import {
  type EnvSecret,
  isEnvSecret,
  isWatchOnly,
  type StoredAccount,
} from "../config/accounts-types.ts";
import {
  createNewAccount,
  DEV_NAMES,
  fromSs58,
  getDevAddress,
  importAccount,
  isDevAccount,
  isHexPublicKey,
  publicKeyToHex,
  toSs58,
  tryDerivePublicKey,
} from "../core/accounts.ts";
import {
  BOLD,
  formatJson,
  isJsonOutput,
  printHeading,
  printImportResults,
  printItem,
  RESET,
  YELLOW,
} from "../core/output.ts";

const ACCOUNT_HELP = `
${BOLD}Usage:${RESET}
  $ dot account add <name> <ss58|hex>                                Add a watch-only address (no secret)
  $ dot account add <name> --secret <s> [--path <derivation>]        Import from BIP39 mnemonic
  $ dot account add <name> --env <VAR> [--path <derivation>]         Import account backed by env variable
  $ dot account create|new <name> [--path <derivation>]              Create a new account
  $ dot account import <file>                                        Batch-import accounts from a file
  $ dot account export [names...]                                    Export accounts to stdout
  $ dot account derive <source> <new-name> --path <derivation>       Derive a child account
  $ dot account inspect <input> [--prefix <N>]                       Inspect an account/address/key
  $ dot account list                                                 List all accounts
  $ dot account remove|delete <name> [name2] ...                     Remove stored account(s)

${BOLD}Examples:${RESET}
  $ dot account add treasury 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
  $ dot account add treasury --secret "word1 word2 ... word12"
  $ dot account add ci-signer --env MY_SECRET --path //ci
  $ dot account create my-validator
  $ dot account create my-staking --path //staking
  $ dot account create multi --path //polkadot//0/wallet
  $ dot account import team-accounts.json
  $ dot account import accounts.json --dry-run
  $ dot account import accounts.json --overwrite
  $ dot account export
  $ dot account export treasury my-validator
  $ dot account export --include-secrets --file backup.json
  $ dot account export --watch-only
  $ dot account derive treasury treasury-staking --path //staking
  $ dot account inspect alice
  $ dot account inspect 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
  $ dot account inspect 0xd435...a27d --prefix 0
  $ dot account list
  $ dot account remove my-validator stale-key

${YELLOW}Note: Secrets are stored unencrypted in ~/.polkadot/accounts.json.
      Use --env to keep secrets off disk entirely.
      Hex seed import (0x...) is not supported via CLI.${RESET}
`.trimStart();

export function registerAccountCommands(cli: CAC) {
  cli
    .command(
      "account [action] [...names]",
      "Manage local accounts (create, import, list, remove, export)",
    )
    .alias("accounts")
    .option("--secret <value>", "Secret key (mnemonic or hex seed) for import")
    .option("--env <varName>", "Environment variable name holding the secret")
    .option("--path <derivation>", "Derivation path (e.g. //staking, //polkadot//0/wallet)")
    .option("--prefix <number>", "SS58 prefix for address encoding (default: 42)")
    .option("--file <path>", "Input/output file for batch import/export")
    .option("--overwrite", "Overwrite existing accounts on batch import")
    .option("--dry-run", "Preview batch import without applying changes")
    .option("--include-secrets", "Include secrets in export (redacted by default)")
    .option("--watch-only", "Export only watch-only accounts")
    .action(
      async (
        action: string | undefined,
        names: string[],
        opts: {
          secret?: string;
          env?: string;
          path?: string;
          prefix?: string;
          file?: string;
          overwrite?: boolean;
          dryRun?: boolean;
          includeSecrets?: boolean;
          watchOnly?: boolean;
          output?: string;
          json?: boolean;
        },
      ) => {
        if (!action) {
          if (process.argv[2] === "accounts") return accountList(opts);
          console.log(ACCOUNT_HELP);
          return;
        }
        switch (action) {
          case "new":
          case "create":
            return accountCreate(names[0], opts);
          case "add":
            if (opts.secret || opts.env) return accountImport(names[0], opts);
            return accountAddWatchOnly(names[0], names[1], opts);
          case "import":
            return accountBatchImport(names[0], opts);
          case "export":
            return accountExport(names, opts);
          case "derive":
            return accountDerive(names[0], names[1], opts);
          case "list":
            return accountList(opts);
          case "delete":
          case "remove":
            return accountRemove(names, opts);
          case "inspect":
            return accountInspect(names[0], opts);
          default:
            return accountInspect(action, opts);
        }
      },
    );
}

async function accountCreate(
  name: string | undefined,
  opts: { path?: string; output?: string; json?: boolean },
) {
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

  // Auto-derive Bandersnatch member keys (unkeyed + candidate)
  const { deriveBandersnatchMember } = await import("../core/bandersnatch.ts");
  const bandersnatch: Record<string, string> = {};
  bandersnatch[""] = publicKeyToHex(deriveBandersnatchMember(mnemonic));
  bandersnatch.candidate = publicKeyToHex(deriveBandersnatchMember(mnemonic, "candidate"));

  accountsFile.accounts.push({
    name,
    secret: mnemonic,
    publicKey: hexPub,
    derivationPath: path,
    bandersnatch,
  });
  await saveAccounts(accountsFile);

  if (isJsonOutput(opts)) {
    console.log(
      formatJson({
        name,
        address,
        publicKey: hexPub,
        mnemonic,
        path: path || undefined,
        bandersnatch,
      }),
    );
    console.error(`Save this mnemonic phrase! It is the only way to recover this account.`);
    return;
  }

  printHeading("Account Created");
  console.log(`  ${BOLD}Name:${RESET}          ${name}`);
  if (path) console.log(`  ${BOLD}Path:${RESET}          ${path}`);
  console.log(`  ${BOLD}Address:${RESET}       ${address}`);
  console.log(`  ${BOLD}Bandersnatch:${RESET}  ${bandersnatch[""]}`);
  console.log(`    ${BOLD}(candidate)${RESET}  ${bandersnatch.candidate}`);
  console.log(`  ${BOLD}Mnemonic:${RESET}      ${mnemonic}`);
  console.log();
  console.log(
    `  ${YELLOW}Save this mnemonic phrase! It is the only way to recover this account.${RESET}`,
  );
  console.log();
}

async function accountImport(
  name: string | undefined,
  opts: { secret?: string; env?: string; path?: string; output?: string; json?: boolean },
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

    if (isJsonOutput(opts)) {
      const address = publicKey ? toSs58(publicKey) : undefined;
      console.log(formatJson({ name, address, env: opts.env, path: path || undefined }));
      return;
    }

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

    if (isJsonOutput(opts)) {
      console.log(formatJson({ name, address, publicKey: hexPub, path: path || undefined }));
      return;
    }

    printHeading("Account Imported");
    console.log(`  ${BOLD}Name:${RESET}    ${name}`);
    if (path) console.log(`  ${BOLD}Path:${RESET}    ${path}`);
    console.log(`  ${BOLD}Address:${RESET} ${address}`);
    console.log();
  }
}

async function accountAddWatchOnly(
  name: string | undefined,
  address: string | undefined,
  opts: { output?: string; json?: boolean } = {},
) {
  if (!name) {
    console.error("Account name is required.\n");
    console.error("Usage: dot account add <name> <ss58-address|0x-public-key>");
    process.exit(1);
  }

  if (!address) {
    console.error("Address is required.\n");
    console.error("Usage: dot account add <name> <ss58-address|0x-public-key>");
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

  // Decode SS58 or hex to get publicKey hex
  let hexPub: string;
  if (isHexPublicKey(address)) {
    hexPub = address;
  } else {
    try {
      const decoded = fromSs58(address);
      hexPub = publicKeyToHex(decoded);
    } catch {
      throw new Error(
        `Invalid address "${address}". Expected an SS58 address or 0x-prefixed 32-byte hex public key.`,
      );
    }
  }

  accountsFile.accounts.push({
    name,
    publicKey: hexPub,
    derivationPath: "",
  });
  await saveAccounts(accountsFile);

  if (isJsonOutput(opts)) {
    console.log(formatJson({ name, address: toSs58(hexPub), watchOnly: true }));
    return;
  }

  printHeading("Account Added (watch-only)");
  console.log(`  ${BOLD}Name:${RESET}    ${name}`);
  console.log(`  ${BOLD}Address:${RESET} ${toSs58(hexPub)}`);
  console.log();
}

async function accountDerive(
  sourceName: string | undefined,
  newName: string | undefined,
  opts: { path?: string; output?: string; json?: boolean },
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

  if (isWatchOnly(source)) {
    throw new Error(`Cannot derive from "${sourceName}": watch-only, no secret.`);
  }

  if (findAccount(accountsFile, newName)) {
    throw new Error(`Account "${newName}" already exists.`);
  }

  const path = opts.path;

  // After the isWatchOnly guard, secret is guaranteed to be defined
  const sourceSecret = source.secret!;

  if (isEnvSecret(sourceSecret)) {
    const publicKey = tryDerivePublicKey(sourceSecret.env, path) ?? "";

    accountsFile.accounts.push({
      name: newName,
      secret: sourceSecret,
      publicKey,
      derivationPath: path,
    });
    await saveAccounts(accountsFile);

    if (isJsonOutput(opts)) {
      const address = publicKey ? toSs58(publicKey) : undefined;
      console.log(
        formatJson({ name: newName, source: sourceName, path, address, env: sourceSecret.env }),
      );
      return;
    }

    printHeading("Account Derived");
    console.log(`  ${BOLD}Name:${RESET}    ${newName}`);
    console.log(`  ${BOLD}Source:${RESET}  ${sourceName}`);
    console.log(`  ${BOLD}Path:${RESET}    ${path}`);
    console.log(`  ${BOLD}Env:${RESET}     ${sourceSecret.env}`);
    if (publicKey) {
      console.log(`  ${BOLD}Address:${RESET} ${toSs58(publicKey)}`);
    } else {
      console.log(`  ${YELLOW}Address will resolve when $${sourceSecret.env} is set.${RESET}`);
    }
    console.log();
  } else {
    const { publicKey } = importAccount(sourceSecret, path);
    const hexPub = publicKeyToHex(publicKey);
    const address = toSs58(publicKey);

    accountsFile.accounts.push({
      name: newName,
      secret: sourceSecret,
      publicKey: hexPub,
      derivationPath: path,
    });
    await saveAccounts(accountsFile);

    if (isJsonOutput(opts)) {
      console.log(
        formatJson({ name: newName, source: sourceName, path, address, publicKey: hexPub }),
      );
      return;
    }

    printHeading("Account Derived");
    console.log(`  ${BOLD}Name:${RESET}    ${newName}`);
    console.log(`  ${BOLD}Source:${RESET}  ${sourceName}`);
    console.log(`  ${BOLD}Path:${RESET}    ${path}`);
    console.log(`  ${BOLD}Address:${RESET} ${address}`);
    console.log();
  }
}

async function accountList(opts: { output?: string; json?: boolean } = {}) {
  const accountsFile = await loadAccounts();

  if (isJsonOutput(opts)) {
    const dev = DEV_NAMES.map((name) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      address: getDevAddress(name),
    }));
    const stored = accountsFile.accounts.map((account) => {
      let address: string | undefined;
      if (isWatchOnly(account)) {
        address = account.publicKey ? toSs58(account.publicKey) : undefined;
      } else if (account.secret !== undefined && isEnvSecret(account.secret)) {
        let pubKey = account.publicKey;
        if (!pubKey) {
          pubKey = tryDerivePublicKey(account.secret.env, account.derivationPath) ?? "";
        }
        address = pubKey ? toSs58(pubKey) : undefined;
      } else {
        address = toSs58(account.publicKey);
      }
      return {
        name: account.name,
        address,
        derivationPath: account.derivationPath || undefined,
        watchOnly: isWatchOnly(account),
        env:
          account.secret !== undefined && isEnvSecret(account.secret)
            ? account.secret.env
            : undefined,
      };
    });
    console.log(formatJson({ dev, stored }));
    return;
  }

  printHeading("Dev Accounts");
  for (const name of DEV_NAMES) {
    const display = name.charAt(0).toUpperCase() + name.slice(1);
    const address = getDevAddress(name);
    printItem(display, address);
  }

  if (accountsFile.accounts.length > 0) {
    printHeading("Stored Accounts");
    for (const account of accountsFile.accounts) {
      let displayName = account.name;
      if (account.derivationPath) {
        displayName += ` (${account.derivationPath})`;
      }
      let address: string;

      if (isWatchOnly(account)) {
        displayName += " (watch-only)";
        address = account.publicKey ? toSs58(account.publicKey) : "n/a";
      } else if (account.secret !== undefined && isEnvSecret(account.secret)) {
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

async function accountRemove(names: string[], opts: { output?: string; json?: boolean } = {}) {
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

  if (isJsonOutput(opts)) {
    console.log(formatJson({ removed: names }));
    return;
  }

  for (const name of names) {
    console.log(`Account "${name}" removed.`);
  }
}

async function accountInspect(
  input: string | undefined,
  opts: { prefix?: string; output?: string },
) {
  if (!input) {
    console.error("Input is required.\n");
    console.error("Usage: dot account inspect <name|ss58-address|0x-public-key> [--prefix <N>]");
    process.exit(1);
  }

  const prefix = opts.prefix != null ? Number(opts.prefix) : 42;
  if (Number.isNaN(prefix) || prefix < 0) {
    console.error(`Invalid prefix "${opts.prefix}". Must be a non-negative integer.`);
    process.exit(1);
  }

  let name: string | undefined;
  let publicKeyHex: string;
  let bandersnatch: Record<string, string> | undefined;

  // 1. Dev account name
  if (isDevAccount(input)) {
    name = input.charAt(0).toUpperCase() + input.slice(1).toLowerCase();
    const devAddr = getDevAddress(input);
    publicKeyHex = publicKeyToHex(fromSs58(devAddr));
  }
  // 2. Stored account name
  else {
    const accountsFile = await loadAccounts();
    const account = findAccount(accountsFile, input);
    if (account) {
      name = account.name;
      bandersnatch = account.bandersnatch;
      if (account.publicKey) {
        publicKeyHex = account.publicKey;
      } else if (account.secret !== undefined && isEnvSecret(account.secret)) {
        const derived = tryDerivePublicKey(account.secret.env, account.derivationPath);
        if (!derived) {
          console.error(
            `Cannot derive public key for "${account.name}": $${account.secret.env} is not set.`,
          );
          process.exit(1);
        }
        publicKeyHex = derived;
      } else {
        // Should not happen for well-formed accounts
        console.error(`Account "${account.name}" has no public key.`);
        process.exit(1);
      }
    }
    // 3. Hex public key
    else if (isHexPublicKey(input)) {
      publicKeyHex = input;
    }
    // 4. Try SS58 decode
    else {
      try {
        const decoded = fromSs58(input);
        publicKeyHex = publicKeyToHex(decoded);
      } catch {
        console.error(
          `Cannot identify "${input}" as an account name, SS58 address, or hex public key.`,
        );
        process.exit(1);
      }
    }
  }

  const ss58 = toSs58(publicKeyHex!, prefix);

  if (isJsonOutput(opts)) {
    const result: Record<string, unknown> = { publicKey: publicKeyHex!, ss58, prefix };
    if (name) result.name = name;
    if (bandersnatch && Object.keys(bandersnatch).length > 0) result.bandersnatch = bandersnatch;
    console.log(formatJson(result));
  } else {
    printHeading("Account Info");
    if (name) console.log(`  ${BOLD}Name:${RESET}        ${name}`);
    console.log(`  ${BOLD}Public Key:${RESET}  ${publicKeyHex!}`);
    console.log(`  ${BOLD}SS58:${RESET}        ${ss58}`);
    if (bandersnatch && Object.keys(bandersnatch).length > 0) {
      const entries = Object.entries(bandersnatch);
      for (let i = 0; i < entries.length; i++) {
        const [key, hex] = entries[i]!;
        const label = key ? `(${key})` : "";
        if (i === 0) {
          console.log(`  ${BOLD}Bandersnatch:${RESET}${label ? ` ${label}` : ""} ${hex}`);
        } else {
          console.log(`               ${label ? `${label} ` : ""}${hex}`);
        }
      }
    }
    console.log(`  ${BOLD}Prefix:${RESET}      ${prefix}`);
    console.log();
  }
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

const REDACTED = "<redacted>";

interface ExportedAccount {
  name: string;
  publicKey: string;
  derivationPath: string;
  secret?: string | EnvSecret;
  bandersnatch?: Record<string, string>;
}

interface AccountExportData {
  accounts: ExportedAccount[];
}

async function accountExport(
  names: string[],
  opts: {
    file?: string;
    includeSecrets?: boolean;
    watchOnly?: boolean;
    output?: string;
    json?: boolean;
  },
) {
  const accountsFile = await loadAccounts();

  if (opts.includeSecrets) {
    process.stderr.write(`${YELLOW}Warning: secrets are included in the export.${RESET}\n`);
  }

  let accounts = accountsFile.accounts;

  if (names.length > 0) {
    const filtered: StoredAccount[] = [];
    for (const input of names) {
      const account = findAccount(accountsFile, input);
      if (!account) {
        throw new Error(`Account "${input}" not found.`);
      }
      filtered.push(account);
    }
    accounts = filtered;
  }

  if (opts.watchOnly) {
    accounts = accounts.filter((a) => isWatchOnly(a));
  }

  const exported: ExportedAccount[] = accounts.map((account) => {
    const entry: ExportedAccount = {
      name: account.name,
      publicKey: account.publicKey,
      derivationPath: account.derivationPath,
    };

    if (isWatchOnly(account)) {
      // No secret field for watch-only
    } else if (account.secret !== undefined && isEnvSecret(account.secret)) {
      // Env var name is always safe to export
      entry.secret = account.secret;
    } else if (opts.includeSecrets) {
      entry.secret = account.secret;
    } else {
      entry.secret = REDACTED;
    }

    if (account.bandersnatch && Object.keys(account.bandersnatch).length > 0) {
      entry.bandersnatch = account.bandersnatch;
    }

    return entry;
  });

  const exportData: AccountExportData = { accounts: exported };
  const json = `${JSON.stringify(exportData, null, 2)}\n`;

  if (opts.file) {
    await writeFile(opts.file, json);
    if (isJsonOutput(opts)) {
      console.log(formatJson({ action: "exported", file: opts.file, count: exported.length }));
    } else {
      console.log(`Exported ${exported.length} account(s) to ${opts.file}`);
    }
  } else {
    process.stdout.write(json);
  }
}

async function accountBatchImport(
  filePath: string | undefined,
  opts: {
    file?: string;
    overwrite?: boolean;
    dryRun?: boolean;
    output?: string;
    json?: boolean;
  },
) {
  const inputPath = filePath ?? opts.file;
  let raw: string;
  if (!inputPath || inputPath === "-") {
    if (process.stdin.isTTY) {
      console.log(ACCOUNT_HELP);
      return;
    }
    raw = await readStdin();
  } else {
    raw = await readFile(inputPath, "utf-8");
  }

  let importData: AccountExportData;
  try {
    importData = JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON input.");
  }

  if (!Array.isArray(importData.accounts)) {
    throw new Error('Invalid import format: missing "accounts" array.');
  }

  const accountsFile = await loadAccounts();
  const added: string[] = [];
  const skipped: string[] = [];
  const overwritten: string[] = [];

  for (const entry of importData.accounts) {
    if (!entry.name) {
      process.stderr.write(`${YELLOW}Skipped entry with missing name.${RESET}\n`);
      continue;
    }

    if (isDevAccount(entry.name)) {
      process.stderr.write(`${YELLOW}Skipped "${entry.name}": built-in dev account.${RESET}\n`);
      skipped.push(entry.name);
      continue;
    }

    const existing = findAccount(accountsFile, entry.name);

    if (existing && !opts.overwrite) {
      skipped.push(entry.name);
      process.stderr.write(
        `${YELLOW}Skipped "${entry.name}": already exists (use --overwrite to replace)${RESET}\n`,
      );
      continue;
    }

    // Build the StoredAccount from the imported entry
    const stored: StoredAccount = {
      name: entry.name,
      publicKey: entry.publicKey || "",
      derivationPath: entry.derivationPath || "",
    };

    if (entry.secret === undefined || entry.secret === REDACTED) {
      // Watch-only: no secret, preserve publicKey
    } else if (typeof entry.secret === "object" && "env" in entry.secret) {
      // Env-backed account
      stored.secret = entry.secret;
      if (!stored.publicKey) {
        stored.publicKey = tryDerivePublicKey(entry.secret.env, stored.derivationPath) ?? "";
      }
    } else if (typeof entry.secret === "string") {
      // Mnemonic or hex seed — validate and derive publicKey
      stored.secret = entry.secret;
      try {
        const { publicKey } = importAccount(entry.secret, stored.derivationPath);
        stored.publicKey = publicKeyToHex(publicKey);
      } catch {
        process.stderr.write(
          `${YELLOW}Warning: "${entry.name}" has an invalid secret, importing as watch-only.${RESET}\n`,
        );
        delete stored.secret;
      }
    }

    if (entry.bandersnatch && Object.keys(entry.bandersnatch).length > 0) {
      stored.bandersnatch = entry.bandersnatch;
    }

    if (existing) {
      // Replace in-place
      const idx = accountsFile.accounts.findIndex(
        (a) => a.name.toLowerCase() === entry.name.toLowerCase(),
      );
      accountsFile.accounts[idx] = stored;
      overwritten.push(entry.name);
    } else {
      accountsFile.accounts.push(stored);
      added.push(entry.name);
    }
  }

  if (!opts.dryRun) {
    await saveAccounts(accountsFile);
  }

  if (isJsonOutput(opts)) {
    console.log(
      formatJson({
        action: opts.dryRun ? "dry-run" : "imported",
        added,
        overwritten,
        skipped,
      }),
    );
    return;
  }

  printImportResults({
    added,
    overwritten,
    skipped,
    dryRun: opts.dryRun ?? false,
    noun: "account",
  });
}
