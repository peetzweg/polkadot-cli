import { describe, test, expect } from "bun:test";
import { runCli } from "./__fixtures__/run-cli.ts";

describe("dot query", () => {
  test("no target shows help", async () => {
    const { stdout, exitCode } = await runCli(["query"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Usage: dot query");
  });
});
