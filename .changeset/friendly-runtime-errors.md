---
"polkadot-cli": patch
---

Friendlier error output when the runtime panics or papi cleanup races leak.

**Runtime wasm traps**

Errors from inside `validate_transaction` (wasm `unreachable` instruction / `Execution aborted due to trap`) used to be printed as a verbatim wasm backtrace from polkadot-api. They now render as a one-paragraph "the runtime rejected this transaction" message that names the failing entrypoint where possible (e.g. `the runtime's validate_transaction step`) and points at `--dry-run` for the next step.

**`--dry-run` no longer hides the reason fee estimation failed**

Previously `dot tx … --dry-run` swallowed any exception from `getEstimatedFees` and printed only `Estimated fees: unable to estimate`. The error reason is now captured and displayed alongside the estimate (and included in the JSON output as `estimationError`), so users see *why* estimation failed before deciding to submit.

**`dot chain update --all` no longer crashes on cleanup races**

`@polkadot-api/observable-client` schedules timers inside its chain-head follow stream that can fire after `client.destroy()` has cleared the connection, rejecting with `Error: Not connected` or `DisjointError`. Previously these unhandled rejections killed the process *after* the actual update work had completed. A `process.on('unhandledRejection')` filter at the CLI entry point now swallows that specific class of teardown noise (matched by name) and lets unrelated rejections through with the new friendlier formatting.
