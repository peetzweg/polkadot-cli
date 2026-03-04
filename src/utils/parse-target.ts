export interface Target {
  chain?: string;
  pallet: string;
  item?: string;
}

export interface ParseTargetOptions {
  knownChains?: string[];
  allowPalletOnly?: boolean;
}

export function parseTarget(input: string, options?: ParseTargetOptions): Target {
  const parts = input.split(".");

  if (options?.allowPalletOnly) {
    switch (parts.length) {
      case 1:
        if (!parts[0]) {
          throw new Error(
            `Invalid target "${input}". Expected format: Pallet or Pallet.Item (e.g. System or System.Account)`,
          );
        }
        return { pallet: parts[0] };

      case 2:
        if (!parts[0] || !parts[1]) {
          throw new Error(
            `Invalid target "${input}". Expected format: Pallet.Item or Chain.Pallet (e.g. System.Account or kusama.System)`,
          );
        }
        // Disambiguate: if first segment matches a known chain, treat as Chain.Pallet
        if (options.knownChains?.some((c) => c.toLowerCase() === parts[0]!.toLowerCase())) {
          return { chain: parts[0], pallet: parts[1] };
        }
        return { pallet: parts[0], item: parts[1] };

      case 3:
        if (!parts[0] || !parts[1] || !parts[2]) {
          throw new Error(
            `Invalid target "${input}". Expected format: Chain.Pallet.Item (e.g. kusama.System.Account)`,
          );
        }
        return { chain: parts[0], pallet: parts[1], item: parts[2] };

      default:
        throw new Error(
          `Invalid target "${input}". Expected format: Pallet, Pallet.Item, or Chain.Pallet.Item`,
        );
    }
  }

  // Default: item is required (for tx, query, const)
  switch (parts.length) {
    case 2:
      if (!parts[0] || !parts[1]) {
        throw new Error(
          `Invalid target "${input}". Expected format: Pallet.Item (e.g. System.Account)`,
        );
      }
      return { pallet: parts[0], item: parts[1] };

    case 3:
      if (!parts[0] || !parts[1] || !parts[2]) {
        throw new Error(
          `Invalid target "${input}". Expected format: Chain.Pallet.Item (e.g. kusama.System.Account)`,
        );
      }
      return { chain: parts[0], pallet: parts[1], item: parts[2] };

    default:
      throw new Error(
        `Invalid target "${input}". Expected format: Pallet.Item (e.g. System.Account)`,
      );
  }
}

/**
 * Resolve the effective chain from a parsed target and optional --chain flag.
 * Errors if both are specified.
 */
export function resolveTargetChain(target: Target, chainFlag?: string): string | undefined {
  if (target.chain && chainFlag) {
    throw new Error(
      `Chain specified both as prefix ("${target.chain}") and as --chain flag ("${chainFlag}"). Use one or the other.`,
    );
  }
  return target.chain ?? chainFlag;
}
