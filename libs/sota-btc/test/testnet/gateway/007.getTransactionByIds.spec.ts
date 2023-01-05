import BtcGateway from '../../../src/BtcGateway';
import assert from 'assert';

const gateway = BtcGateway.getInstance();

describe('getTransactionByIds', () => {
  it('should get transactions by lots of ids', async () => {
    // get 0 transaction
    const txs = await gateway.getTransactionsByIds([]);
    assert(txs.length === 0);

    // get 1 transaction
    const txs2 = await gateway.getTransactionsByIds([
      '665bfb9eb55c865f99faca122ed301f7b1c2e78483ad48ec0dede66e8c727ee0',
    ]);
    assert(txs2.length === 1);
    assert(txs2[0].height > 0);
    assert(txs2[0].confirmations > 0);

    // get if input is equal to null
    const txs3 = await gateway.getTransactionsByIds(null);
    assert(txs3 && txs3.length === 0);

    // get 2 transactions
    const txs4 = await gateway.getTransactionsByIds([
      'a647d0c4112b4727f3c856782ff6bbaf099be929b27214a8e0dfedee4383eb68',
      '24b8a4c788b8c805b810438ddd99e569e184ff20f4394ac49a6d832e69f57242',
    ]);
    assert(txs4.length === 2);
    assert(txs4[0].height === 500);
    assert(txs4[1].height === 500);

    try {
      // get transaction with wrong txids
      const txs5 = await gateway.getTransactionsByIds([
        'a647d0c4112b472756782ff6bbaf099be929b27214a8e0dfedee4383eb68',
        '24b8a4c788b8c805b810438ddd99e569e184ff20f4394ac49a6d832e69f57242',
        'sp123123mfkuasd44444uad12931239123912',
        'sp123123mfkuasd44444uad1293123912391212312312321',
        'sp123123mfkuasd44444uad129312391239126776',
        'sp123123mfkuasd44444uad12931239123912aasdada',
        'sp123123mfkuasd44444uad12931239123912aldlaskaldk',
      ]);
    } catch (e) {
      assert(e);
    }
  });
});
