// Per-file serialization helper for tests that mutate process.env.DOT_HOME.
//
// `bun test --concurrent` runs tests within a file in parallel — they share
// process.env. Without serialization, tmpHome mutations from concurrent
// tests trample each other and `loadMetadata` / `loadMetadataFingerprint`
// can read the wrong directory mid-test.
//
// Each test file that imports this gets its OWN module-scoped lock (because
// each test file is a fresh module evaluation under bun's worker model). So
// this mutex serializes within-file env mutations, while between-file
// isolation is provided by bun's per-file process.env separation.

let lock: Promise<unknown> = Promise.resolve();

export async function withDotHome<T>(tmpHome: string, fn: () => Promise<T>): Promise<T> {
  const prior = lock;
  let release: () => void = () => {};
  lock = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    await prior;
  } catch {
    // ignore prior errors
  }
  const original = process.env.DOT_HOME;
  process.env.DOT_HOME = tmpHome;
  try {
    return await fn();
  } finally {
    if (original === undefined) delete process.env.DOT_HOME;
    else process.env.DOT_HOME = original;
    release();
  }
}
