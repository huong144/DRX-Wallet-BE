import BtcGateway from '../../../src/BtcGateway';
import assert from 'assert';

const gateway = BtcGateway.getInstance();

describe('createRawTransaction', () => {
  it('should create raw transaction from input data', async function() {
    // @ts-ignore
    this.timeout(30000);
    // raw
    // const fromAddr = 'mmJzRfnQHyxPhfgbK2q8pC8dZuqMgHUUtN';
    // const toAddr = 'mhJEnsPjbS5ENc3KZD52v9YDss8fgD5gd8';
    // const amount;
    // const raw = await gateway.constructRawTransaction(fromAddr, toAddr, amount);
    // assert(raw.unsignedRaw.length > 0);
    // assert(raw.txid.length > 0);

    // TODO: Revive me
    assert(true);
  });
});
