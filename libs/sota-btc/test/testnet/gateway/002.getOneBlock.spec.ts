import BtcGateway from '../../../src/BtcGateway';
import assert from 'assert';

const gateway = BtcGateway.getInstance();

describe('getOneBlock', () => {
  it('should get one block by number', async () => {
    const blockNumber = 1450131;
    const block = await gateway.getOneBlock(blockNumber);
    assert.equal(block.hash, '0000000000000040b81d1acc29ddc305bd8adf4c67693178209fe46825335018');
    assert.equal(block.number, blockNumber);
    assert.equal(block.txids.length, 61);
  });
});
