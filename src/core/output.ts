const isTTY = process.stdout.isTTY ?? false;

const RESET = isTTY ? "\x1b[0m" : "";
const CYAN = isTTY ? "\x1b[36m" : "";
const GREEN = isTTY ? "\x1b[32m" : "";
const YELLOW = isTTY ? "\x1b[33m" : "";
const MAGENTA = isTTY ? "\x1b[35m" : "";
const DIM = isTTY ? "\x1b[2m" : "";
const BOLD = isTTY ? "\x1b[1m" : "";

function replacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Uint8Array) return "0x" + Buffer.from(value).toString("hex");
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
  return json.replace(
    /("(?:\\.|[^"\\])*")\s*:/g,
    `${CYAN}$1${RESET}:`,
  ).replace(
    /:\s*("(?:\\.|[^"\\])*")/g,
    (match, str) => match.replace(str, `${GREEN}${str}${RESET}`),
  ).replace(
    /:\s*(\d+(?:\.\d+)?)/g,
    (match, num) => match.replace(num, `${YELLOW}${num}${RESET}`),
  ).replace(
    /:\s*(true|false)/g,
    (match, bool) => match.replace(bool, `${MAGENTA}${bool}${RESET}`),
  ).replace(
    /:\s*(null)/g,
    (match, n) => match.replace(n, `${DIM}${n}${RESET}`),
  );
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

export { BOLD, CYAN, DIM, GREEN, MAGENTA, RESET, YELLOW };
