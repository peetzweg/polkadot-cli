import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  __resetDryRunHintForTests,
  isGlobalDryRun,
  printGlobalDryRunHint,
  resolveDryRun,
} from "./dry-run.ts";

describe("isGlobalDryRun", () => {
  const original = process.env.DOT_DRY_RUN;
  afterEach(() => {
    if (original === undefined) delete process.env.DOT_DRY_RUN;
    else process.env.DOT_DRY_RUN = original;
  });

  test("unset is false", () => {
    delete process.env.DOT_DRY_RUN;
    expect(isGlobalDryRun()).toBe(false);
  });

  test("empty string is false", () => {
    process.env.DOT_DRY_RUN = "";
    expect(isGlobalDryRun()).toBe(false);
  });

  test("truthy values are true", () => {
    for (const v of ["1", "true", "TRUE", "yes", "On", " 1 "]) {
      process.env.DOT_DRY_RUN = v;
      expect(isGlobalDryRun()).toBe(true);
    }
  });

  test("falsey values are false", () => {
    for (const v of ["0", "false", "no", "off"]) {
      process.env.DOT_DRY_RUN = v;
      expect(isGlobalDryRun()).toBe(false);
    }
  });
});

describe("resolveDryRun", () => {
  const original = process.env.DOT_DRY_RUN;
  beforeEach(() => {
    delete process.env.DOT_DRY_RUN;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.DOT_DRY_RUN;
    else process.env.DOT_DRY_RUN = original;
  });

  test("explicit --dry-run wins over env off", () => {
    expect(resolveDryRun(true)).toBe(true);
  });

  test("explicit --no-dry-run wins over env on", () => {
    process.env.DOT_DRY_RUN = "1";
    expect(resolveDryRun(false)).toBe(false);
  });

  test("env on with no flag forces dry-run", () => {
    process.env.DOT_DRY_RUN = "1";
    expect(resolveDryRun(undefined)).toBe(true);
  });

  test("env off with no flag is off", () => {
    expect(resolveDryRun(undefined)).toBe(false);
  });

  test("decode-only path is never forced by env", () => {
    process.env.DOT_DRY_RUN = "1";
    expect(resolveDryRun(undefined, true)).toBe(false);
  });

  test("decode-only still honors an explicit flag", () => {
    process.env.DOT_DRY_RUN = "1";
    expect(resolveDryRun(true, true)).toBe(true);
  });
});

describe("printGlobalDryRunHint", () => {
  let captured: string;
  let originalWrite: typeof process.stderr.write;

  beforeEach(() => {
    __resetDryRunHintForTests();
    captured = "";
    originalWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string) => {
      captured += chunk;
      return true;
    }) as typeof process.stderr.write;
  });

  afterEach(() => {
    process.stderr.write = originalWrite;
    __resetDryRunHintForTests();
  });

  test("writes the hint to stderr", () => {
    printGlobalDryRunHint();
    expect(captured).toContain("DOT_DRY_RUN is set");
    expect(captured).toContain("simulated, not submitted");
  });

  test("is idempotent within a process (prints at most once)", () => {
    printGlobalDryRunHint();
    printGlobalDryRunHint();
    const occurrences = captured.split("DOT_DRY_RUN is set").length - 1;
    expect(occurrences).toBe(1);
  });
});
