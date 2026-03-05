import { describe, expect, test } from "bun:test";
import { papiLink, pjsAppsLink } from "./explorers.ts";

describe("pjsAppsLink", () => {
  test("returns correct URL with encoded RPC and hash", () => {
    const url = pjsAppsLink("wss://rpc.polkadot.io", "0xabc123");
    expect(url).toBe(
      "https://polkadot.js.org/apps/?rpc=wss%3A%2F%2Frpc.polkadot.io#/explorer/query/0xabc123",
    );
  });

  test("URI-encodes special characters in the RPC parameter", () => {
    const url = pjsAppsLink("wss://example.com?foo=bar&baz=1", "0xdef");
    expect(url).toBe(
      `https://polkadot.js.org/apps/?rpc=${encodeURIComponent("wss://example.com?foo=bar&baz=1")}#/explorer/query/0xdef`,
    );
  });
});

describe("papiLink", () => {
  test("returns correct URL with hash in path and encoded RPC in query", () => {
    const url = papiLink("wss://rpc.polkadot.io", "0xabc123");
    expect(url).toBe(
      "https://dev.papi.how/explorer/0xabc123#networkId=custom&endpoint=wss%3A%2F%2Frpc.polkadot.io",
    );
  });

  test("URI-encodes special characters in the RPC parameter", () => {
    const url = papiLink("wss://example.com?foo=bar&baz=1", "0xdef");
    expect(url).toBe(
      `https://dev.papi.how/explorer/0xdef#networkId=custom&endpoint=${encodeURIComponent("wss://example.com?foo=bar&baz=1")}`,
    );
  });
});
