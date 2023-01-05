import BtcGateway from '../../../src/BtcGateway';
import assert from 'assert';

const gateway = BtcGateway.getInstance();

describe('getBlockTransactions', () => {
  it('should get transactions of block 500', async function f() {
    // @ts-ignore
    this.timeout(30000);
    // blockResult
    const blockResult = await gateway.getBlockTransactions(500);
    assert(blockResult);
  });
});
