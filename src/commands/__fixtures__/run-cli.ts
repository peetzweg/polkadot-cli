import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const FIXTURE_METADATA = join(import.meta.dir, "polkadot-metadata.bin");
const CLI_PATH = join(import.meta.dir, "../../cli.ts");

export async function runCli(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const tmpHome = mkdtempSync(join(tmpdir(), "dot-test-"));
  const chainDir = join(tmpHome, ".polkadot", "chains", "polkadot");
  mkdirSync(chainDir, { recursive: true });
  copyFileSync(FIXTURE_METADATA, join(chainDir, "metadata.bin"));
  writeFileSync(
    join(tmpHome, ".polkadot", "config.json"),
    JSON.stringify({
      defaultChain: "polkadot",
      chains: { polkadot: { rpc: "wss://rpc.polkadot.io" } },
    }),
  );

  try {
    const proc = Bun.spawn(["bun", CLI_PATH, ...args], {
      env: { ...process.env, HOME: tmpHome },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    const exitCode = await proc.exited;
    return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode };
  } finally {
    rmSync(tmpHome, { recursive: true, force: true });
  }
}
