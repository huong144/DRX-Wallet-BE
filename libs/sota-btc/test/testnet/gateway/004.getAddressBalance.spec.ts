import BtcGateway from '../../../src/BtcGateway';
import assert from 'assert';

const gateway = BtcGateway.getInstance();

describe('getAddressBalance', () => {
  it('Valid address, valid balance', async function() {
    // @ts-ignore
    this.timeout(30000);
    const balance = await gateway.getAddressBalance('mxUnthsrZGK8V7jZ1NGanroEfYatCa6poU');
    assert(balance.gt(0));
  });
});

describe('getAddressUtxos', () => {
  it('Valid address, valid utxos', async () => {
    const utxos = await gateway.getOneAddressUtxos('mxUnthsrZGK8V7jZ1NGanroEfYatCa6poU');
    assert(utxos.length >= 0);
  });
});
