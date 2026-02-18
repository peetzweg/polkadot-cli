function levenshtein(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  const dp: number[][] = Array.from({ length: la + 1 }, () =>
    Array(lb + 1).fill(0),
  );
  for (let i = 0; i <= la; i++) dp[i]![0] = i;
  for (let j = 0; j <= lb; j++) dp[0]![j] = j;
  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + cost,
      );
    }
  }
  return dp[la]![lb]!;
}

export function findClosest(
  input: string,
  candidates: string[],
  maxDistance = 3,
): string[] {
  const lower = input.toLowerCase();

  // Exact case-insensitive match
  const exact = candidates.find((c) => c.toLowerCase() === lower);
  if (exact) return [exact];

  // Levenshtein-based suggestions
  const scored = candidates
    .map((c) => ({ name: c, dist: levenshtein(lower, c.toLowerCase()) }))
    .filter((s) => s.dist <= maxDistance)
    .sort((a, b) => a.dist - b.dist);

  return scored.slice(0, 3).map((s) => s.name);
}

export function suggestMessage(
  kind: string,
  input: string,
  candidates: string[],
): string {
  const suggestions = findClosest(input, candidates);
  if (suggestions.length === 0) {
    return `Unknown ${kind} "${input}".`;
  }
  if (suggestions.length === 1 && suggestions[0]!.toLowerCase() === input.toLowerCase()) {
    return suggestions[0]!;
  }
  return `Unknown ${kind} "${input}". Did you mean: ${suggestions.join(", ")}?`;
}
