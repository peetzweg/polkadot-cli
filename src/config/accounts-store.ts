import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AccountsFile, StoredAccount } from "./accounts-types.ts";
import { getConfigDir } from "./store.ts";

function getAccountsPath(): string {
  return join(getConfigDir(), "accounts.json");
}

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function loadAccounts(): Promise<AccountsFile> {
  await ensureDir(getConfigDir());
  const path = getAccountsPath();
  if (await fileExists(path)) {
    const data = await readFile(path, "utf-8");
    return JSON.parse(data) as AccountsFile;
  }
  return { accounts: [] };
}

export async function saveAccounts(file: AccountsFile): Promise<void> {
  await ensureDir(getConfigDir());
  await writeFile(getAccountsPath(), `${JSON.stringify(file, null, 2)}\n`);
}

export function findAccount(file: AccountsFile, name: string): StoredAccount | undefined {
  return file.accounts.find((a) => a.name.toLowerCase() === name.toLowerCase());
}
