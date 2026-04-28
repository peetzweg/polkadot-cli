// Per-file serialization helper for tests that mutate process.env.DOT_HOME
// (and any other env vars passed via the optional `env` map).
//
// `bun test --concurrent` runs tests within a file in parallel — they share
// process.env. Without serialization, tmpHome mutations from concurrent
// tests trample each other and `loadMetadata` / `loadMetadataFingerprint`
// can read the wrong directory mid-test. Any other env var that affects
// production behavior (e.g. DOT_TRUST_CACHED_METADATA) has the same
// problem if set/cleared outside this helper, so this helper accepts an
// `env` map and serializes those mutations under the same lock.
//
// Each test file that imports this gets its OWN module-scoped lock (because
// each test file is a fresh module evaluation under bun's worker model). So
// this mutex serializes within-file env mutations, while between-file
// isolation is provided by bun's per-file process.env separation.

let lock: Promise<unknown> = Promise.resolve();

export async function withDotHome<T>(
  tmpHome: string,
  fn: () => Promise<T>,
  env: Record<string, string | undefined> = {},
): Promise<T> {
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
  const originalDotHome = process.env.DOT_HOME;
  const originalEnv: Record<string, string | undefined> = {};
  for (const k of Object.keys(env)) originalEnv[k] = process.env[k];
  process.env.DOT_HOME = tmpHome;
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return await fn();
  } finally {
    if (originalDotHome === undefined) delete process.env.DOT_HOME;
    else process.env.DOT_HOME = originalDotHome;
    for (const [k, v] of Object.entries(originalEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    release();
  }
}
