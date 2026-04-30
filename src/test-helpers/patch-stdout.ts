// Patches process.stdout.write to capture output in-process for handlers
// that use the awaitable callback form of stdout.write (the drain-safe
// primitive in src/core/output.ts). The patched write fires the callback
// synchronously so the awaiting handler resolves under tests. Strips the
// trailing newline before handing each chunk to the capture callback.
export function patchStdout(capture: (msg: string) => void): () => void {
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: unknown, ...rest: unknown[]) => {
    const text = typeof chunk === "string" ? chunk : String(chunk);
    capture(text.endsWith("\n") ? text.slice(0, -1) : text);
    const cb = rest.find((a) => typeof a === "function") as ((err?: Error) => void) | undefined;
    cb?.();
    return true;
  }) as typeof process.stdout.write;
  return () => {
    process.stdout.write = original;
  };
}
