import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getConfigDir } from "../config/store.ts";

const CACHE_FILE = "update-check.json";
const STALE_MS = 24 * 60 * 60 * 1000; // 24 hours
const FETCH_TIMEOUT_MS = 5000;
const EXIT_WAIT_TIMEOUT_MS = 500;
const RETRY_AFTER_FAILURE_MS = 60 * 60 * 1000; // 1 hour
const REGISTRY_URL = "https://registry.npmjs.org/polkadot-cli/latest";

let pendingCheck: Promise<void> | null = null;

interface UpdateCache {
  lastCheck: number;
  latestVersion: string;
}

/** Strip pre-release suffix and parse semver into [major, minor, patch] */
function parseSemver(v: string): [number, number, number] {
  const clean = v.replace(/^v/, "").split("-")[0] ?? v;
  const parts = clean.split(".").map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

/** Compare two semver strings: returns -1 if a < b, 0 if equal, 1 if a > b */
export function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  for (let i = 0; i < 3; i++) {
    const left = pa[i] ?? 0;
    const right = pb[i] ?? 0;
    if (left < right) return -1;
    if (left > right) return 1;
  }
  return 0;
}

/** Returns true if latest is newer than current */
export function isNewerVersion(current: string, latest: string): boolean {
  return compareSemver(current, latest) < 0;
}

/** Renders a pnpm-style colored notification box */
export function buildNotificationBox(current: string, latest: string): string {
  const YELLOW = "\x1b[33m";
  const GREEN = "\x1b[32m";
  const CYAN = "\x1b[36m";
  const RESET = "\x1b[0m";
  const BOLD = "\x1b[1m";

  const line1 = `Update available! ${YELLOW}${current}${RESET} → ${GREEN}${BOLD}${latest}${RESET}`;
  const line2 = `Run ${CYAN}npm i -g polkadot-cli${RESET} to update`;

  // Calculate visible lengths (without ANSI codes)
  const visibleLine1 = `Update available! ${current} → ${latest}`;
  const visibleLine2 = `Run npm i -g polkadot-cli to update`;
  const innerWidth = Math.max(visibleLine1.length, visibleLine2.length) + 4;

  const pad1 = " ".repeat(innerWidth - visibleLine1.length - 4);
  const pad2 = " ".repeat(innerWidth - visibleLine2.length - 4);
  const empty = " ".repeat(innerWidth);

  const top = `╭${"─".repeat(innerWidth)}╮`;
  const bot = `╰${"─".repeat(innerWidth)}╯`;

  return [
    top,
    `│${empty}│`,
    `│  ${line1}${pad1}  │`,
    `│  ${line2}${pad2}  │`,
    `│${empty}│`,
    bot,
  ].join("\n");
}

function getCachePath(): string {
  return join(getConfigDir(), CACHE_FILE);
}

function readCache(): UpdateCache | null {
  try {
    const data = readFileSync(getCachePath(), "utf-8");
    return JSON.parse(data) as UpdateCache;
  } catch {
    return null;
  }
}

async function writeCache(cache: UpdateCache): Promise<void> {
  try {
    await mkdir(getConfigDir(), { recursive: true });
    await writeFile(getCachePath(), `${JSON.stringify(cache)}\n`);
  } catch {
    // silently ignore write errors
  }
}

/**
 * Fire-and-forget background check. Reads cache synchronously;
 * if stale or missing, fetches latest version from npm registry.
 */
export function startBackgroundCheck(currentVersion: string): void {
  const cache = readCache();
  const now = Date.now();

  if (cache && now - cache.lastCheck < STALE_MS) {
    return; // cache is fresh
  }

  pendingCheck = fetch(REGISTRY_URL, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
    .then((res) => res.json())
    .then((data: any) => {
      const latestVersion = data.version;
      if (typeof latestVersion === "string") {
        return writeCache({ lastCheck: now, latestVersion });
      }
    })
    .catch(() => {
      // Write a failure cache entry with a 1-hour TTL so we don't
      // re-fetch (and block exit for 500ms) on every invocation when
      // the network is down.
      return writeCache({
        lastCheck: now - STALE_MS + RETRY_AFTER_FAILURE_MS,
        latestVersion: currentVersion,
      });
    });
}

/**
 * Waits for a pending background check to complete, with a timeout
 * so fast commands are not blocked for more than EXIT_WAIT_TIMEOUT_MS.
 */
export async function waitForPendingCheck(): Promise<void> {
  if (!pendingCheck) return;
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, EXIT_WAIT_TIMEOUT_MS));
  await Promise.race([pendingCheck.catch(() => {}), timeout]);
  pendingCheck = null;
}

/** @internal — exposed for unit tests only */
export function _setPendingCheckForTest(p: Promise<void> | null): void {
  pendingCheck = p;
}

/**
 * Returns the update notification string if an update is available,
 * or null if disabled / up-to-date / no cache.
 */
export function getUpdateNotification(currentVersion: string): string | null {
  if (process.env.DOT_NO_UPDATE_CHECK === "1") return null;
  if (process.env.CI) return null;
  if (!process.stderr.isTTY) return null;

  const cache = readCache();
  if (!cache) return null;

  if (isNewerVersion(currentVersion, cache.latestVersion)) {
    return buildNotificationBox(currentVersion, cache.latestVersion);
  }

  return null;
}
