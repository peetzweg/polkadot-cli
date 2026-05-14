import { describe, expect, test } from "bun:test";
import {
  formatRuntimeError,
  isBlockUnavailableError,
  isLikelyStaleMetadataError,
  isPapiCleanupError,
} from "./errors.ts";

describe("isPapiCleanupError", () => {
  test("matches bare 'Not connected'", () => {
    expect(isPapiCleanupError(new Error("Not connected"))).toBe(true);
  });

  test("matches DisjointError", () => {
    expect(isPapiCleanupError(new Error("DisjointError: chain head was disconnected"))).toBe(true);
  });

  test("matches aborted ChainHead messages", () => {
    expect(isPapiCleanupError(new Error("ChainHead operation aborted"))).toBe(true);
  });

  test("does not match unrelated errors", () => {
    expect(isPapiCleanupError(new Error("ECONNREFUSED"))).toBe(false);
    expect(isPapiCleanupError(new Error("Invalid signature"))).toBe(false);
  });

  test("does not match non-Error values", () => {
    expect(isPapiCleanupError("Not connected")).toBe(false);
    expect(isPapiCleanupError(undefined)).toBe(false);
    expect(isPapiCleanupError(null)).toBe(false);
  });
});

describe("formatRuntimeError", () => {
  test("rewrites a wasm trap from validate_transaction", () => {
    const wasmErr = new Error(
      [
        "Execution failed: Execution aborted due to trap: wasm trap: wasm `unreachable` instruction executed",
        "WASM backtrace:",
        "    0:  0x1e8c1 - next_people_paseo_runtime.wasm!__rustc[d131491b]::rust_begin_unwind",
        "    1:   0x32ae - next_people_paseo_runtime.wasm!core::panicking::panic_fmt::h076e68bde4b88b39",
        "    2: 0x5bf2d0 - next_people_paseo_runtime.wasm!TaggedTransactionQueue_validate_transaction",
      ].join("\n"),
    );
    const formatted = formatRuntimeError(wasmErr);
    expect(formatted).toContain("The runtime rejected this transaction");
    expect(formatted).toContain("validate_transaction step");
    expect(formatted).toContain("--dry-run");
    expect(formatted).not.toContain("0x5bf2d0");
  });

  test("rewrites a generic wasm trap with no recognised function", () => {
    const wasmErr = new Error(
      "Execution failed: Execution aborted due to trap: wasm trap: wasm `unreachable` instruction executed",
    );
    const formatted = formatRuntimeError(wasmErr);
    expect(formatted).toContain("The runtime rejected this transaction in the runtime");
  });

  test("frames Invalid Transaction errors", () => {
    const formatted = formatRuntimeError(new Error("Invalid Transaction: BadProof"));
    expect(formatted).toContain("Transaction rejected as invalid");
    expect(formatted).toContain("BadProof");
  });

  test("passes other error messages through unchanged", () => {
    expect(formatRuntimeError(new Error("ECONNREFUSED"))).toBe("ECONNREFUSED");
  });

  test("handles non-Error values", () => {
    expect(formatRuntimeError("plain string")).toBe("plain string");
    expect(formatRuntimeError(42)).toBe("42");
  });
});

describe("isLikelyStaleMetadataError", () => {
  test("matches wasm trap errors", () => {
    expect(
      isLikelyStaleMetadataError(
        new Error("Execution aborted due to trap: wasm `unreachable` instruction executed"),
      ),
    ).toBe(true);
  });

  test("matches codec / decode failures", () => {
    expect(isLikelyStaleMetadataError(new Error("codec error: invalid input"))).toBe(true);
    expect(isLikelyStaleMetadataError(new Error("Decoding failed: end of buffer"))).toBe(true);
    expect(isLikelyStaleMetadataError(new Error("Lookup failed for type id 42"))).toBe(true);
  });

  test("matches metadata mismatch", () => {
    expect(isLikelyStaleMetadataError(new Error("metadata mismatch detected"))).toBe(true);
  });

  test("does NOT match user-typo errors", () => {
    expect(isLikelyStaleMetadataError(new Error("pallet 'Foo' not found"))).toBe(false);
    expect(isLikelyStaleMetadataError(new Error("call 'bar' not found in pallet System"))).toBe(
      false,
    );
    expect(isLikelyStaleMetadataError(new Error("BadOrigin"))).toBe(false);
  });

  test("ignores empty / non-string-y values", () => {
    expect(isLikelyStaleMetadataError(undefined)).toBe(false);
    expect(isLikelyStaleMetadataError(null)).toBe(false);
    expect(isLikelyStaleMetadataError(42)).toBe(false);
  });

  test("matches plain strings (not just Error instances)", () => {
    expect(isLikelyStaleMetadataError("wasm trap: unreachable")).toBe(true);
  });
});

describe("isBlockUnavailableError", () => {
  test("matches BlockHashNotFoundError shape", () => {
    expect(
      isBlockUnavailableError(
        new Error(
          "Invalid BlockHash: 0x4d7d68d4ad6d0bdfe6c693b88736e1c5a9f2c8eaf2c2c5e8d5b7b6e6f0a1b2c3",
        ),
      ),
    ).toBe(true);
  });

  test("matches StorageError UnknownBlock shape", () => {
    expect(
      isBlockUnavailableError(
        new Error("Storage Error: UnknownBlock: Header was not found in the database: 0x4d7d..."),
      ),
    ).toBe(true);
  });

  test("matches the 'is not pinned' wrapper papi raises from chainHead_v1", () => {
    expect(isBlockUnavailableError(new Error("Block 0xabc is not pinned (storage)"))).toBe(true);
  });

  test("does not match unrelated errors", () => {
    expect(isBlockUnavailableError(new Error("ECONNREFUSED"))).toBe(false);
    expect(isBlockUnavailableError(new Error("Invalid Transaction: BadProof"))).toBe(false);
    expect(isBlockUnavailableError(new Error("pallet 'Foo' not found"))).toBe(false);
  });

  test("ignores empty / non-string-y values", () => {
    expect(isBlockUnavailableError(undefined)).toBe(false);
    expect(isBlockUnavailableError(null)).toBe(false);
    expect(isBlockUnavailableError(42)).toBe(false);
  });

  test("matches plain strings (not just Error instances)", () => {
    expect(isBlockUnavailableError("Invalid BlockHash: 0xdead")).toBe(true);
  });
});
