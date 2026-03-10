import { Binary } from "polkadot-api";

const isTTY = process.stdout.isTTY ?? false;

const RESET = isTTY ? "\x1b[0m" : "";
const CYAN = isTTY ? "\x1b[36m" : "";
const GREEN = isTTY ? "\x1b[32m" : "";
const RED = isTTY ? "\x1b[31m" : "";
const YELLOW = isTTY ? "\x1b[33m" : "";
const MAGENTA = isTTY ? "\x1b[35m" : "";
const DIM = isTTY ? "\x1b[2m" : "";
const BOLD = isTTY ? "\x1b[1m" : "";

function replacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Binary) {
    const text = value.asText();
    return text.includes("\uFFFD") ? value.asHex() : text;
  }
  if (value instanceof Uint8Array) return `0x${Buffer.from(value).toString("hex")}`;
  return value;
}

export function formatJson(data: unknown): string {
  return JSON.stringify(data, replacer, 2);
}

export function formatPretty(data: unknown): string {
  const json = JSON.stringify(data, replacer, 2);
  if (!json) return "undefined";
  return colorizeJson(json);
}

function colorizeJson(json: string): string {
  return json
    .replace(/("(?:\\.|[^"\\])*")\s*:/g, `${CYAN}$1${RESET}:`)
    .replace(/:\s*("(?:\\.|[^"\\])*")/g, (match, str) =>
      match.replace(str, `${GREEN}${str}${RESET}`),
    )
    .replace(/:\s*(\d+(?:\.\d+)?)/g, (match, num) => match.replace(num, `${YELLOW}${num}${RESET}`))
    .replace(/:\s*(true|false)/g, (match, bool) => match.replace(bool, `${MAGENTA}${bool}${RESET}`))
    .replace(/:\s*(null)/g, (match, n) => match.replace(n, `${DIM}${n}${RESET}`));
}

export function printResult(data: unknown, format: string = "pretty"): void {
  if (format === "json") {
    console.log(formatJson(data));
  } else {
    console.log(formatPretty(data));
  }
}

export function printHeading(text: string): void {
  console.log(`\n${BOLD}${text}${RESET}\n`);
}

export function printItem(name: string, description?: string): void {
  if (description) {
    console.log(`  ${CYAN}${name}${RESET}  ${DIM}${description}${RESET}`);
  } else {
    console.log(`  ${CYAN}${name}${RESET}`);
  }
}

export function printDocs(docs: string[]): void {
  const text = docs.join("\n").trim();
  if (text) {
    console.log(`  ${DIM}${text}${RESET}`);
  }
}

const CHECK_MARK = "✓";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

class Spinner {
  private timer: ReturnType<typeof setInterval> | null = null;
  private frame = 0;

  start(msg: string): void {
    this.stop();
    if (!isTTY) {
      console.error(msg);
      return;
    }
    process.stdout.write(`${SPINNER_FRAMES[0]} ${msg}`);
    this.timer = setInterval(() => {
      this.frame = (this.frame + 1) % SPINNER_FRAMES.length;
      process.stdout.write(`\r\x1b[K${SPINNER_FRAMES[this.frame]} ${msg}`);
    }, 80);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
      this.frame = 0;
      if (isTTY) process.stdout.write("\r\x1b[K");
    }
  }

  succeed(msg: string): void {
    this.stop();
    console.error(`${GREEN}${CHECK_MARK}${RESET} ${msg}`);
  }
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return `${str.slice(0, maxLen - 3)}...`;
}

export { BOLD, CHECK_MARK, CYAN, DIM, GREEN, isTTY, MAGENTA, RED, RESET, Spinner, YELLOW };
