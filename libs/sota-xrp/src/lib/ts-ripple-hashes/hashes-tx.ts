import * as ripple_hashes_1 from 'ripple-hashes';

export function hashesTx(rawTx: string): string {
  return ripple_hashes_1.computeBinaryTransactionHash(rawTx);
}
