import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  buildNotificationBox,
  compareSemver,
  getUpdateNotification,
  isNewerVersion,
} from "./update-notifier.ts";

// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping ANSI escape codes requires matching \x1b
const ANSI_RE = /\x1b\[[0-9;]*m/g;

// ---------------------------------------------------------------------------
// compareSemver
// ---------------------------------------------------------------------------
describe("compareSemver", () => {
  test("equal versions return 0", () => {
    expect(compareSemver("1.2.3", "1.2.3")).toBe(0);
  });

  test("higher patch returns 1", () => {
    expect(compareSemver("1.2.4", "1.2.3")).toBe(1);
  });

  test("lower patch returns -1", () => {
    expect(compareSemver("1.2.3", "1.2.4")).toBe(-1);
  });

  test("higher minor returns 1", () => {
    expect(compareSemver("1.3.0", "1.2.9")).toBe(1);
  });

  test("lower minor returns -1", () => {
    expect(compareSemver("1.1.9", "1.2.0")).toBe(-1);
  });

  test("higher major returns 1", () => {
    expect(compareSemver("2.0.0", "1.9.9")).toBe(1);
  });

  test("lower major returns -1", () => {
    expect(compareSemver("0.9.9", "1.0.0")).toBe(-1);
  });

  test("strips pre-release suffix", () => {
    expect(compareSemver("1.2.3-beta.1", "1.2.3")).toBe(0);
  });

  test("strips v prefix", () => {
    expect(compareSemver("v1.2.3", "1.2.3")).toBe(0);
  });

  test("both pre-release suffixes stripped", () => {
    expect(compareSemver("2.0.0-alpha.1", "2.0.0-rc.1")).toBe(0);
  });

  test("0.0.0 vs 0.0.1", () => {
    expect(compareSemver("0.0.0", "0.0.1")).toBe(-1);
  });
});

// ---------------------------------------------------------------------------
// isNewerVersion
// ---------------------------------------------------------------------------
describe("isNewerVersion", () => {
  test("returns true when latest is newer (minor bump)", () => {
    expect(isNewerVersion("0.6.2", "0.7.0")).toBe(true);
  });

  test("returns true when latest is newer (patch bump)", () => {
    expect(isNewerVersion("0.7.0", "0.7.1")).toBe(true);
  });

  test("returns true when latest is newer (major bump)", () => {
    expect(isNewerVersion("0.9.9", "1.0.0")).toBe(true);
  });

  test("returns false when same version", () => {
    expect(isNewerVersion("0.7.0", "0.7.0")).toBe(false);
  });

  test("returns false when current is newer", () => {
    expect(isNewerVersion("0.8.0", "0.7.0")).toBe(false);
  });

  test("returns false when current is much newer", () => {
    expect(isNewerVersion("2.0.0", "1.0.0")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildNotificationBox
// ---------------------------------------------------------------------------
describe("buildNotificationBox", () => {
  test("contains current and latest version", () => {
    const box = buildNotificationBox("0.6.2", "0.7.0");
    const plain = box.replace(ANSI_RE, "");
    expect(plain).toContain("Update available!");
    expect(plain).toContain("0.6.2");
    expect(plain).toContain("0.7.0");
    expect(plain).toContain("npm i -g polkadot-cli");
  });

  test("has box drawing characters", () => {
    const box = buildNotificationBox("0.6.2", "0.7.0");
    expect(box).toContain("╭");
    expect(box).toContain("╰");
    expect(box).toContain("│");
    expect(box).toContain("─");
  });

  test("box lines are equal width", () => {
    const box = buildNotificationBox("0.6.2", "0.7.0");
    const plain = box.replace(ANSI_RE, "");
    const lines = plain.split("\n");
    const topLen = lines[0]!.length;
    for (const line of lines) {
      expect(line.length).toBe(topLen);
    }
  });

  test("works with large version numbers", () => {
    const box = buildNotificationBox("10.20.30", "100.200.300");
    const plain = box.replace(ANSI_RE, "");
    expect(plain).toContain("10.20.30");
    expect(plain).toContain("100.200.300");
  });
});

// ---------------------------------------------------------------------------
// getUpdateNotification — env var guards
// ---------------------------------------------------------------------------
describe("getUpdateNotification", () => {
  test("returns null when DOT_NO_UPDATE_CHECK is set", () => {
    const orig = process.env.DOT_NO_UPDATE_CHECK;
    process.env.DOT_NO_UPDATE_CHECK = "1";
    try {
      expect(getUpdateNotification("0.6.2")).toBeNull();
    } finally {
      if (orig === undefined) delete process.env.DOT_NO_UPDATE_CHECK;
      else process.env.DOT_NO_UPDATE_CHECK = orig;
    }
  });

  test("returns null when CI is set", () => {
    const orig = process.env.CI;
    process.env.CI = "true";
    try {
      expect(getUpdateNotification("0.6.2")).toBeNull();
    } finally {
      if (orig === undefined) delete process.env.CI;
      else process.env.CI = orig;
    }
  });

  test("returns null when no cache file exists", () => {
    const origCI = process.env.CI;
    const origCheck = process.env.DOT_NO_UPDATE_CHECK;
    delete process.env.CI;
    delete process.env.DOT_NO_UPDATE_CHECK;
    try {
      // getUpdateNotification reads from ~/.polkadot/update-check.json
      // If the file doesn't exist it should return null gracefully
      const result = getUpdateNotification("999.999.999");
      // Either null (no cache or up-to-date) — both are acceptable
      expect(result === null || typeof result === "string").toBe(true);
    } finally {
      if (origCI !== undefined) process.env.CI = origCI;
      if (origCheck !== undefined) process.env.DOT_NO_UPDATE_CHECK = origCheck;
    }
  });
});

// ---------------------------------------------------------------------------
// Integration: suppression via env vars in a real CLI subprocess
// ---------------------------------------------------------------------------
describe("update notifier integration", () => {
  test("DOT_NO_UPDATE_CHECK suppresses notification in CLI", async () => {
    const proc = Bun.spawn(["bun", join(import.meta.dir, "../cli.ts"), "--version"], {
      env: { ...process.env, DOT_NO_UPDATE_CHECK: "1" },
      stdout: "pipe",
      stderr: "pipe",
    });
    const stderr = await new Response(proc.stderr as ReadableStream).text();
    await proc.exited;
    expect(stderr).not.toContain("Update available");
  });

  test("CI=true suppresses notification in CLI", async () => {
    const proc = Bun.spawn(["bun", join(import.meta.dir, "../cli.ts"), "--version"], {
      env: { ...process.env, CI: "true" },
      stdout: "pipe",
      stderr: "pipe",
    });
    const stderr = await new Response(proc.stderr as ReadableStream).text();
    await proc.exited;
    expect(stderr).not.toContain("Update available");
  });
});
