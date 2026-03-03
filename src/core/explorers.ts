export const pjsAppsLink = (rpc: string, hash: string) =>
  `https://polkadot.js.org/apps/?rpc=${encodeURIComponent(rpc)}#/explorer/query/${hash}`;

export const papiLink = (rpc: string, hash: string) =>
  `https://dev.papi.how/explorer/${hash}#networkId=custom&endpoint=${encodeURIComponent(rpc)}`;
