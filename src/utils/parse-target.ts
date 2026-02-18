export interface Target {
  pallet: string;
  item: string;
}

export function parseTarget(input: string): Target {
  const parts = input.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(
      `Invalid target "${input}". Expected format: Pallet.Item (e.g. System.Account)`,
    );
  }
  return { pallet: parts[0], item: parts[1] };
}
