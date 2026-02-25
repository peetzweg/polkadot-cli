import { join } from "node:path";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { getConfigDir } from "./store.ts";
import type { AccountsFile, StoredAccount } from "./accounts-types.ts";

const ACCOUNTS_PATH = join(getConfigDir(), "accounts.json");

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
  if (await fileExists(ACCOUNTS_PATH)) {
    const data = await readFile(ACCOUNTS_PATH, "utf-8");
    return JSON.parse(data) as AccountsFile;
  }
  return { accounts: [] };
}

export async function saveAccounts(file: AccountsFile): Promise<void> {
  await ensureDir(getConfigDir());
  await writeFile(ACCOUNTS_PATH, JSON.stringify(file, null, 2) + "\n");
}

export function findAccount(
  file: AccountsFile,
  name: string,
): StoredAccount | undefined {
  return file.accounts.find(
    (a) => a.name.toLowerCase() === name.toLowerCase(),
  );
}
