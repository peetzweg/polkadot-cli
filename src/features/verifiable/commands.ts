import { readFile } from "node:fs/promises";
import { DEV_PHRASE } from "@polkadot-labs/hdkd-helpers";
import { Binary } from "polkadot-api";
import {
  BOLD,
  CliError,
  createChainClient,
  DEV_NAMES,
  findAccount,
  findClosest,
  formatJson,
  fromSs58,
  getOrFetchMetadata,
  isDevAccount,
  isHexPublicKey,
  isJsonOutput,
  isWatchOnly,
  loadAccounts,
  loadConfig,
  parseInputData,
  printHeading,
  publicKeyToHex,
  RESET,
  resolveChain,
  resolveDataInput,
  resolveSecret,
  saveAccounts,
  toHex,
} from "../../platform/index.ts";
import {
  aliasProofMessage,
  assembleRingMembers,
  bandersnatchSign,
  DEFAULT_RING_EXPONENT,
  deriveAlias,
  deriveBandersnatchMember,
  deriveMemberEntropy,
  deriveMemberKey,
  encodeContext,
  encodeMembers,
  isRingExponent,
  pickLatestRingRoot,
  type RingExponent,
  type RingKeyPageEntry,
  type RingRootRecord,
  resolveEntropyKey,
  ringProve,
  verifyBandersnatchSig,
  verifyRingProof,
} from "./lib.ts";
import type { VerifiableOpts } from "./register.ts";

/** Dispatch a `dot verifiable` invocation. Loaded lazily by `./register.ts`. */
export async function runVerifiable(action: string, rest: string[], opts: VerifiableOpts) {
  switch (action) {
    case "member":
      return deriveMember(rest[0], opts);
    case "alias":
      return deriveAliasCmd(rest[0], opts);
    case "sign":
      return signCmd(rest[0], opts);
    case "prove":
      return proveCmd(rest[0], opts);
    case "verify":
      return verifyCmd(opts);
    case "verify-sig":
      return verifySigCmd(opts);
    case "members":
      return membersCmd(rest, opts);
    case "msg":
      return msgCmd(rest, opts);
    case "ring":
      return ringCmd(rest, opts);
    default:
      // Back-compat: `dot verifiable <account>` derives the member key.
      return deriveMember(action, opts);
  }
}

// --- Shared helpers ---

type AccountsFile = Awaited<ReturnType<typeof loadAccounts>>;
type StoredAccount = NonNullable<ReturnType<typeof findAccount>>;

function mnemonicFromStored(
  stored: StoredAccount | undefined,
  account: string,
  accountsFile: AccountsFile,
): string {
  if (!stored) {
    const available = [...DEV_NAMES, ...accountsFile.accounts.map((a) => a.name)].sort((a, b) =>
      a.localeCompare(b),
    );
    const suggestions = findClosest(account, available);
    const hint = suggestions.length > 0 ? `\n  Did you mean: ${suggestions.join(", ")}?` : "";
    const list = available.map((a) => `\n    - ${a}`).join("");
    throw new Error(`Unknown account "${account}".${hint}\n  Available accounts:${list}`);
  }

  if (isWatchOnly(stored)) {
    throw new Error(
      `Account "${account}" is watch-only (no secret). Cannot derive Bandersnatch key.`,
    );
  }

  const secret = resolveSecret(stored.secret!);

  if (isHexPublicKey(`0x${secret.replace(/^0x/, "")}`)) {
    throw new Error(
      `Account "${account}" uses a hex seed. Bandersnatch derivation requires a BIP39 mnemonic.`,
    );
  }

  return secret;
}

async function resolveMnemonic(account: string): Promise<string> {
  if (isDevAccount(account)) {
    return DEV_PHRASE;
  }
  const accountsFile = await loadAccounts();
  return mnemonicFromStored(findAccount(accountsFile, account), account, accountsFile);
}

async function resolveEntropy(
  account: string,
  entropyKey: string | undefined,
): Promise<Uint8Array> {
  const mnemonic = await resolveMnemonic(account);
  return deriveMemberEntropy(mnemonic, resolveEntropyKey(entropyKey));
}

function requireAccount(account: string | undefined, action: string): string {
  if (!account) {
    throw new CliError(`dot verifiable ${action} requires an account. See "dot verifiable".`);
  }
  return account;
}

function resolveMessage(opts: VerifiableOpts): Promise<Uint8Array> {
  return resolveDataInput(opts.message, opts, {
    conflict: "Provide only one of: --message, --file, or --stdin",
    missing: "No message provided. Use --message, --file, or --stdin",
  });
}

/** Resolve a bytes argument that is either 0x-hex or (when allowFile) a file path. */
async function resolveBytesArg(
  value: string,
  name: string,
  allowFile = false,
): Promise<Uint8Array> {
  if (value.startsWith("0x")) {
    return parseInputData(value);
  }
  if (allowFile) {
    const buf = await readFile(value);
    const text = buf.toString("utf8").trim();
    return text.startsWith("0x") ? parseInputData(text) : new Uint8Array(buf);
  }
  throw new CliError(`${name} must be 0x-prefixed hex`);
}

function resolveRingExponent(opts: VerifiableOpts) {
  if (opts.ringExponent === undefined) return DEFAULT_RING_EXPONENT;
  const n = Number(opts.ringExponent);
  if (!isRingExponent(n)) {
    throw new CliError(`Invalid --ring-exponent "${opts.ringExponent}". Supported: 9, 10, 14.`);
  }
  return n;
}

function requireOption(value: string | undefined, flag: string, action: string): string {
  if (value === undefined) {
    throw new CliError(`dot verifiable ${action} requires ${flag}.`);
  }
  return value;
}

// --- Actions ---

async function deriveMember(accountArg: string | undefined, opts: VerifiableOpts) {
  const account = requireAccount(accountArg, "member");

  // Migration: `--context` used to mean the entropy-derivation key on this
  // command. It now means the 32-byte ring context elsewhere. Preserve old
  // behavior here for one release, with a deprecation warning.
  const usedDeprecatedContext = opts.entropyKey === undefined && opts.context !== undefined;
  if (usedDeprecatedContext) {
    if (opts.context!.startsWith("0x")) {
      // The previous release mangled 0x values before hashing (mri coerced
      // them to numbers), so carrying them through would silently derive a
      // different member key than either release. Require the explicit flag.
      throw new CliError(
        `"--context" on "dot verifiable" now means the 32-byte ring context, and hex ` +
          `entropy keys changed meaning in this release. Pass "--entropy-key ${opts.context}" explicitly.`,
      );
    }
    process.stderr.write(
      `Warning: "--context" on "dot verifiable" now refers to the 32-byte ring context. ` +
        `For member-key derivation use "--entropy-key". Treating "--context ${opts.context}" ` +
        `as the entropy key for now.\n`,
    );
  }
  const entropyKeyStr = opts.entropyKey ?? opts.context;

  let mnemonic: string;
  let accountsFile: AccountsFile | undefined;
  let stored: StoredAccount | undefined;
  if (isDevAccount(account)) {
    mnemonic = DEV_PHRASE;
  } else {
    accountsFile = await loadAccounts();
    stored = findAccount(accountsFile, account);
    mnemonic = mnemonicFromStored(stored, account, accountsFile);
  }

  const memberKeyHex = publicKeyToHex(deriveBandersnatchMember(mnemonic, entropyKeyStr));

  if (stored && accountsFile) {
    if (!stored.bandersnatch) stored.bandersnatch = {};
    const entryKey = entropyKeyStr ?? "";
    if (stored.bandersnatch[entryKey] !== memberKeyHex) {
      stored.bandersnatch[entryKey] = memberKeyHex;
      await saveAccounts(accountsFile);
    }
  }

  // Output label: keep `context` naming when the deprecated flag was used so
  // existing scripts/output stay stable; use `entropyKey` for the new flag.
  const fieldKey = usedDeprecatedContext ? "context" : "entropyKey";

  if (isJsonOutput(opts)) {
    const result: Record<string, unknown> = { account, memberKey: memberKeyHex };
    if (entropyKeyStr) result[fieldKey] = entropyKeyStr;
    console.log(formatJson(result));
  } else {
    printHeading("Bandersnatch Member Key");
    console.log(`  ${BOLD}Account:${RESET}    ${account}`);
    if (entropyKeyStr) {
      const line = usedDeprecatedContext
        ? `  ${BOLD}Context:${RESET}    ${entropyKeyStr}`
        : `  ${BOLD}Entropy Key:${RESET} ${entropyKeyStr}`;
      console.log(line);
    }
    console.log(`  ${BOLD}Member Key:${RESET} ${memberKeyHex}`);
    console.log();
  }
}

async function deriveAliasCmd(accountArg: string | undefined, opts: VerifiableOpts) {
  const account = requireAccount(accountArg, "alias");
  const contextStr = requireOption(opts.context, "--context", "alias");
  const entropy = await resolveEntropy(account, opts.entropyKey);
  const context = encodeContext(contextStr);
  const aliasHex = toHex(deriveAlias(entropy, context));

  if (isJsonOutput(opts)) {
    console.log(formatJson({ account, context: contextStr, alias: aliasHex }));
  } else {
    printHeading("Verifiable Alias");
    console.log(`  ${BOLD}Account:${RESET} ${account}`);
    console.log(`  ${BOLD}Context:${RESET} ${contextStr}`);
    console.log(`  ${BOLD}Alias:${RESET}   ${aliasHex}`);
    console.log();
  }
}

async function signCmd(accountArg: string | undefined, opts: VerifiableOpts) {
  const account = requireAccount(accountArg, "sign");
  const message = await resolveMessage(opts);
  const entropy = await resolveEntropy(account, opts.entropyKey);
  const signature = bandersnatchSign(entropy, message);
  const member = deriveMemberKey(entropy);
  const sigHex = toHex(signature);
  const result = {
    type: "Bandersnatch",
    account,
    message: toHex(message),
    signature: sigHex,
    member: toHex(member),
    enum: `Bandersnatch(${sigHex})`,
  };

  if (isJsonOutput(opts)) {
    console.log(formatJson(result));
  } else {
    console.log(`  ${BOLD}Type:${RESET}       ${result.type}`);
    console.log(`  ${BOLD}Message:${RESET}    ${result.message}`);
    console.log(`  ${BOLD}Signature:${RESET}  ${result.signature}`);
    console.log(`  ${BOLD}Member:${RESET}     ${result.member}`);
    console.log(`  ${BOLD}Enum:${RESET}       ${result.enum}`);
  }
}

async function proveCmd(accountArg: string | undefined, opts: VerifiableOpts) {
  const account = requireAccount(accountArg, "prove");
  const contextStr = requireOption(opts.context, "--context", "prove");
  const membersArg = requireOption(opts.members, "--members", "prove");
  const message = await resolveMessage(opts);
  const ringExponent = resolveRingExponent(opts);
  const entropy = await resolveEntropy(account, opts.entropyKey);
  const context = encodeContext(contextStr);
  const members = await resolveBytesArg(membersArg, "--members", true);

  const { proof, alias } = ringProve(ringExponent, entropy, members, context, message);
  const result = {
    account,
    context: contextStr,
    ringExponent,
    alias: toHex(alias),
    proof: toHex(proof),
  };

  if (isJsonOutput(opts)) {
    console.log(formatJson(result));
  } else {
    printHeading("Ring-VRF Proof");
    console.log(`  ${BOLD}Account:${RESET}       ${account}`);
    console.log(`  ${BOLD}Context:${RESET}       ${contextStr}`);
    console.log(`  ${BOLD}Ring exponent:${RESET} ${ringExponent}`);
    console.log(`  ${BOLD}Alias:${RESET}         ${result.alias}`);
    console.log(`  ${BOLD}Proof:${RESET}         ${result.proof}`);
    console.log();
  }
}

async function verifyCmd(opts: VerifiableOpts) {
  const proofArg = requireOption(opts.proof, "--proof", "verify");
  const contextStr = requireOption(opts.context, "--context", "verify");
  if (!opts.members && !opts.root) {
    throw new CliError("dot verifiable verify requires --members or --root.");
  }
  if (opts.members && opts.root) {
    throw new CliError("Provide either --members or --root, not both.");
  }
  const message = await resolveMessage(opts);
  const ringExponent = resolveRingExponent(opts);
  const proof = await resolveBytesArg(proofArg, "--proof", true);
  const context = encodeContext(contextStr);
  const source = opts.root
    ? { commitment: await resolveBytesArg(opts.root, "--root", true) }
    : { members: await resolveBytesArg(opts.members!, "--members", true) };

  let aliasHex: string;
  try {
    aliasHex = toHex(verifyRingProof(ringExponent, proof, source, context, message));
  } catch (err) {
    const exponentHint =
      opts.ringExponent === undefined
        ? ` (assumed ring exponent ${ringExponent} — pass --ring-exponent if the ring uses 10 or 14)`
        : "";
    throw new CliError(
      `Ring-VRF proof is invalid: ${err instanceof Error ? err.message : String(err)}${exponentHint}`,
    );
  }

  if (isJsonOutput(opts)) {
    console.log(formatJson({ valid: true, alias: aliasHex, ringExponent }));
  } else {
    printHeading("Ring-VRF Verification");
    console.log(`  ${BOLD}Valid:${RESET} yes`);
    console.log(`  ${BOLD}Alias:${RESET} ${aliasHex}`);
    console.log();
  }
}

async function verifySigCmd(opts: VerifiableOpts) {
  const sigArg = requireOption(opts.signature, "--signature", "verify-sig");
  const memberArg = requireOption(opts.member, "--member", "verify-sig");
  const message = await resolveMessage(opts);
  const signature = await resolveBytesArg(sigArg, "--signature", true);
  const member = await resolveBytesArg(memberArg, "--member");

  const valid = verifyBandersnatchSig(signature, message, member);
  if (!valid) {
    throw new CliError("Bandersnatch signature is invalid.");
  }

  if (isJsonOutput(opts)) {
    console.log(formatJson({ valid: true }));
  } else {
    printHeading("Bandersnatch Signature Verification");
    console.log(`  ${BOLD}Valid:${RESET} yes`);
    console.log();
  }
}

async function membersCmd(rest: string[], opts: VerifiableOpts) {
  // Allow an optional `encode` verb: `dot verifiable members encode 0x… 0x…`.
  const keys = rest[0] === "encode" ? rest.slice(1) : rest;
  if (keys.length === 0) {
    throw new CliError("dot verifiable members requires one or more 0x-hex member keys.");
  }
  const memberBytes = keys.map((k) => {
    const bytes = parseInputData(k);
    if (bytes.length !== 32) {
      throw new CliError(`member key must be 32 bytes (got ${bytes.length}): ${k}`);
    }
    return bytes;
  });
  const encoded = toHex(encodeMembers(memberBytes));

  if (isJsonOutput(opts)) {
    console.log(formatJson({ count: keys.length, members: encoded }));
  } else {
    printHeading("Encoded Members");
    console.log(`  ${BOLD}Count:${RESET}   ${keys.length}`);
    console.log(`  ${BOLD}Members:${RESET} ${encoded}`);
    console.log();
  }
}

async function msgCmd(rest: string[], opts: VerifiableOpts) {
  const kind = rest[0];
  if (kind !== "alias") {
    throw new CliError(
      `Unknown msg type "${kind ?? ""}". Supported: alias (set_alias_account / reprove_alias_account).`,
    );
  }
  const accountArg = requireOption(opts.account, "--account", "msg alias");
  const validAtStr = requireOption(opts.validAt, "--valid-at", "msg alias");

  const pubkey = accountArg.startsWith("0x") ? parseInputData(accountArg) : fromSs58(accountArg);
  if (pubkey.length !== 32) {
    throw new CliError("--account must be a 32-byte SS58 address or 0x-hex public key");
  }
  let validAt: bigint;
  try {
    validAt = BigInt(validAtStr);
  } catch {
    throw new CliError(`--valid-at must be an integer (got "${validAtStr}")`);
  }
  if (validAt < 0n || validAt > 0xffffffffffffffffn) {
    throw new CliError(`--valid-at must be a u64 (0 ≤ value < 2^64, got "${validAtStr}")`);
  }

  const message = toHex(aliasProofMessage(pubkey, validAt));

  if (isJsonOutput(opts)) {
    console.log(formatJson({ account: accountArg, validAt: validAtStr, message }));
  } else {
    printHeading("Alias Proof Message");
    console.log(`  ${BOLD}Account:${RESET}  ${accountArg}`);
    console.log(`  ${BOLD}Valid at:${RESET} ${validAtStr}`);
    console.log(`  ${BOLD}Message:${RESET}  ${message}`);
    console.log();
  }
}

/** papi's getUnsafeApi is intentionally untyped. */
type UnsafeApi = any;

/** Wrap a 32-byte collection identifier as the Binary papi expects for a sized-binary storage key. */
function collectionKey(collection: Uint8Array) {
  return Binary.fromHex(toHex(collection) as `0x${string}`);
}

function parseRingIndex(opts: VerifiableOpts): number {
  if (opts.ring === undefined) return 0;
  const n = Number(opts.ring);
  if (!Number.isInteger(n) || n < 0) {
    throw new CliError(`--ring must be a non-negative integer (got "${opts.ring}")`);
  }
  return n;
}

/** Resolve a 32-byte collection identifier from a 0x-hex arg, or the chain's
 *  AliasAccounts.PeopleCollectionIdentifier constant when omitted. */
async function resolveCollection(
  arg: string | undefined,
  api: UnsafeApi,
  allowConstant: boolean,
): Promise<Uint8Array> {
  if (arg !== undefined) {
    const bytes = parseInputData(arg);
    if (bytes.length !== 32) {
      throw new CliError(`collection identifier must be 32 bytes (got ${bytes.length})`);
    }
    return bytes;
  }
  if (allowConstant) {
    try {
      const ident = await api.constants.AliasAccounts.PeopleCollectionIdentifier();
      return ident.asBytes();
    } catch {
      throw new CliError(
        "No collection given and AliasAccounts.PeopleCollectionIdentifier constant is unavailable on this chain. Pass the 32-byte collection explicitly.",
      );
    }
  }
  throw new CliError("A 32-byte collection identifier is required.");
}

async function readRingExponent(api: UnsafeApi, collection: Uint8Array): Promise<RingExponent> {
  try {
    const value = await api.query.MembersSubscriber.RingCollectionExponents.getValue(
      collectionKey(collection),
    );
    // papi decodes the RingExponent enum as { type: "R2e9" | "R2e10" | "R2e14" }.
    const match = /R2e(\d+)/.exec(String(value?.type ?? ""));
    if (match) {
      const n = Number(match[1]);
      if (isRingExponent(n)) return n;
    }
  } catch {
    // fall through to the warning + default
  }
  process.stderr.write(
    `Warning: could not read the ring exponent from the chain; assuming ${DEFAULT_RING_EXPONENT}.\n`,
  );
  return DEFAULT_RING_EXPONENT;
}

async function ringCmd(rest: string[], opts: VerifiableOpts) {
  const kind = rest[0];
  if (kind !== "members" && kind !== "root") {
    throw new CliError(
      `Unknown ring source "${kind ?? ""}". Supported: members (People), root (Asset Hub).`,
    );
  }
  const ring = parseRingIndex(opts);
  const config = await loadConfig();
  const { name: chainName, chain: chainConfig } = resolveChain(config, opts.chain);
  const clientHandle = await createChainClient(chainName, chainConfig, opts.rpc);

  try {
    await getOrFetchMetadata(chainName, clientHandle);
    const api: UnsafeApi = clientHandle.client.getUnsafeApi();

    if (kind === "members") {
      const collection = await resolveCollection(rest[1], api, false);
      // Partial key args filter to this (collection, ring) server-side; only
      // the matching pages are transferred and decoded.
      const entries = await api.query.Members.RingKeys.getEntries(collectionKey(collection), ring);
      const mapped: RingKeyPageEntry[] = entries.map((e: UnsafeApi) => ({
        collection: e.keyArgs[0].asBytes(),
        ring: Number(e.keyArgs[1]),
        page: Number(e.keyArgs[2]),
        keys: (e.value as UnsafeApi[]).map((k) => k.asBytes()),
      }));
      const { members, count } = assembleRingMembers(mapped, collection, ring);
      const result = {
        chain: chainName,
        collection: toHex(collection),
        ring,
        count,
        members: toHex(members),
      };
      if (isJsonOutput(opts)) {
        console.log(formatJson(result));
      } else {
        printHeading("Ring Members");
        console.log(`  ${BOLD}Chain:${RESET}      ${chainName}`);
        console.log(`  ${BOLD}Collection:${RESET} ${result.collection}`);
        console.log(`  ${BOLD}Ring:${RESET}       ${ring}`);
        console.log(`  ${BOLD}Count:${RESET}      ${count}`);
        console.log(`  ${BOLD}Members:${RESET}    ${result.members}`);
        console.log();
      }
      return;
    }

    // kind === "root" — the roots and the exponent are independent reads.
    const collection = await resolveCollection(rest[1], api, true);
    const [records, ringExponent] = await Promise.all([
      api.query.MembersSubscriber.RingRoots.getValue(collectionKey(collection), ring),
      readRingExponent(api, collection),
    ]);
    const mapped: RingRootRecord[] = ((records as UnsafeApi[]) ?? []).map((r: UnsafeApi) => ({
      revision: Number(r.revision),
      root: r.root.asBytes(),
    }));
    const latest = pickLatestRingRoot(mapped);
    const result = {
      chain: chainName,
      collection: toHex(collection),
      ring,
      revision: latest.revision,
      ringExponent,
      root: toHex(latest.root),
    };
    if (isJsonOutput(opts)) {
      console.log(formatJson(result));
    } else {
      printHeading("Ring Root");
      console.log(`  ${BOLD}Chain:${RESET}         ${chainName}`);
      console.log(`  ${BOLD}Collection:${RESET}    ${result.collection}`);
      console.log(`  ${BOLD}Ring:${RESET}          ${ring}`);
      console.log(`  ${BOLD}Revision:${RESET}      ${latest.revision}`);
      console.log(`  ${BOLD}Ring exponent:${RESET} ${ringExponent}`);
      console.log(`  ${BOLD}Root:${RESET}          ${result.root}`);
      console.log();
    }
  } finally {
    clientHandle.destroy();
  }
}
