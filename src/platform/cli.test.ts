import { describe, expect, test } from "bun:test";
import cac from "cac";
import {
  printMatchedCommandHelp,
  readRawOptionValue,
  registerGlobalOptions,
  withHelp,
} from "./cli.ts";

// In-process unit tests for the per-command help registry (issue #238). The
// end-to-end behaviour is covered by spawned-CLI tests in commands/*.test.ts,
// but those run in subprocesses and don't contribute to in-process coverage —
// so we exercise the registry functions directly here.

function buildCli() {
  const cli = cac("dot");
  registerGlobalOptions(cli);
  return cli;
}

describe("platform/cli help registry", () => {
  test("withHelp returns the command for chaining", () => {
    const cli = buildCli();
    const command = cli.command("demo [action]", "demo");
    expect(withHelp(command, () => {})).toBe(command);
  });

  test("printMatchedCommandHelp runs the registered printer for the matched command", () => {
    const cli = buildCli();
    let printed = 0;
    withHelp(
      cli.command("widget [action] [...rest]", "widget").action(() => {}),
      () => {
        printed++;
      },
    );
    cli.command("[dotpath] [...args]", "default").action(() => {});
    cli.option("--help, -h", "help");

    // `dot widget add --help` — an action positional plus --help must still
    // resolve to the registered printer rather than running the action.
    cli.parse(["bun", "dot", "widget", "add", "--help"], { run: false });
    expect(printMatchedCommandHelp(cli)).toBe(true);
    expect(printed).toBe(1);
  });

  test("printMatchedCommandHelp falls back to cac outputHelp when no custom printer", () => {
    const cli = buildCli();
    const command = cli.command("gadget <name>", "gadget").action(() => {});
    withHelp(command); // no custom printer → cac auto-help
    cli.option("--help, -h", "help");

    const original = console.log;
    const lines: string[] = [];
    console.log = (...args: unknown[]) => {
      lines.push(args.join(" "));
    };
    try {
      cli.parse(["bun", "dot", "gadget", "--help"], { run: false });
      expect(printMatchedCommandHelp(cli)).toBe(true);
    } finally {
      console.log = original;
    }
    expect(lines.join("\n")).toContain("gadget");
  });

  test("printMatchedCommandHelp returns false for an unregistered matched command", () => {
    const cli = buildCli();
    cli.command("[dotpath] [...args]", "default").action(() => {});
    cli.option("--help, -h", "help");
    cli.parse(["bun", "dot", "polkadot.query.System.Account"], { run: false });
    // The default dot-path command is intentionally not registered, so the
    // caller falls through to running it (preserving item-level help).
    expect(printMatchedCommandHelp(cli)).toBe(false);
  });

  test("printMatchedCommandHelp returns false when no command matched", () => {
    const cli = buildCli();
    cli.command("solo", "solo").action(() => {});
    cli.option("--help, -h", "help");
    cli.parse(["bun", "dot"], { run: false });
    expect(printMatchedCommandHelp(cli)).toBe(false);
  });
});

describe("platform/cli global options + raw option reader", () => {
  test("registerGlobalOptions exposes the shared flags", () => {
    const cli = buildCli();
    const names = cli.globalCommand.options.map((o) => o.name);
    expect(names).toContain("chain");
    expect(names).toContain("rpc");
    expect(names).toContain("output");
    expect(names).toContain("json");
  });

  test("readRawOptionValue reads --name value and --name=value, last wins", () => {
    expect(readRawOptionValue("chain", ["--chain", "polkadot"])).toBe("polkadot");
    expect(readRawOptionValue("chain", ["--chain=paseo"])).toBe("paseo");
    expect(readRawOptionValue("chain", ["--chain", "a", "--chain", "b"])).toBe("b");
  });

  test("readRawOptionValue stops at the -- terminator and ignores prefix siblings", () => {
    expect(readRawOptionValue("member", ["--members", "0xdead", "--member", "0xbeef"])).toBe(
      "0xbeef",
    );
    expect(readRawOptionValue("chain", ["--", "--chain", "polkadot"])).toBeUndefined();
    expect(readRawOptionValue("chain", ["query.System"])).toBeUndefined();
  });
});
