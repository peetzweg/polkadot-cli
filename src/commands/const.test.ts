import { describe, test, expect } from "bun:test";
import { runCli } from "./__fixtures__/run-cli.ts";

describe("dot const", () => {
  test("no target shows help", async () => {
    const { stdout, exitCode } = await runCli(["const"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Usage: dot const");
  });
});
