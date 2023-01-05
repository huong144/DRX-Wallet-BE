/// <reference types="node" />

declare module 'ripple-hashes' {
  export function computeBinaryTransactionHash(txBlobHex: string): string;
}
