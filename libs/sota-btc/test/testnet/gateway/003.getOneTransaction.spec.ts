import BtcGateway from '../../../src/BtcGateway';
import assert from 'assert';

const gateway = BtcGateway.getInstance();

describe('getOneTransaction', () => {
  it('should get one transaction by txid', async () => {
    const txid = 'e82651823b009afc7605ae0c9bcb523d99925aaa5fe9ee2ca2c0192d2e0681d1';
    const tx = await gateway.getOneTransaction(txid);
    assert.equal(tx.txid, txid);

    const recipients = tx.extractEntries();
    assert.equal(recipients[0].amount.toString(), '1000000');
    assert.equal(recipients[0].currency.symbol, 'btc');
    assert.equal(recipients[0].address, 'mghKRjdqkLWppwEvnQAfvx8GbUD7TDuLbo');
  });
});
