import { createClient as createSubstrateClient } from "@polkadot-api/substrate-client";
import { getWsProvider } from "polkadot-api/ws";
import { ConnectionError } from "../utils/errors.ts";

export interface RpcMethodsResponse {
  methods: string[];
  version: number;
}

function suppressProviderNoise(): () => void {
  const origError = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes("Unable to connect")) return;
    origError(...args);
  };
  return () => {
    console.error = origError;
  };
}

/**
 * Send a single raw JSON-RPC request to a node and return the result.
 *
 * Opens a one-shot sidecar WebSocket provider — does not share the connection
 * with the metadata-aware polkadot-api client. This is intentional: the chainHead
 * follow stream that the high-level client maintains is unrelated to legacy
 * one-shot RPC calls and would only complicate cleanup.
 */
export async function rpcRequest<T>(
  rpcUrl: string | string[],
  method: string,
  params: unknown[],
  timeoutMs = 30_000,
): Promise<T> {
  const restoreConsole = suppressProviderNoise();
  const provider = getWsProvider(rpcUrl, { timeout: 10_000 });
  const client = createSubstrateClient(provider);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await client.request<T>(method, params, controller.signal);
  } catch (err) {
    if (err instanceof Error && /Unable to connect/i.test(err.message)) {
      throw new ConnectionError(
        `Could not reach RPC ${Array.isArray(rpcUrl) ? rpcUrl.join(", ") : rpcUrl}: ${err.message}`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
    try {
      client.destroy();
    } catch {
      // benign teardown race
    }
    setTimeout(restoreConsole, 100);
  }
}

/**
 * Discover the JSON-RPC methods this node exposes via the standard
 * `rpc_methods` endpoint. Returns `{methods, version}` per the spec.
 */
export async function fetchRpcMethods(rpcUrl: string | string[]): Promise<RpcMethodsResponse> {
  const result = await rpcRequest<{ methods: string[]; version?: number }>(
    rpcUrl,
    "rpc_methods",
    [],
  );
  if (!result || !Array.isArray(result.methods)) {
    throw new ConnectionError(
      "Node returned an unexpected response for rpc_methods (no methods array).",
    );
  }
  return { methods: result.methods, version: result.version ?? 1 };
}
