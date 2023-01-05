import BtcGateway from '../../../src/BtcGateway';
import assert from 'assert';

const gateway = BtcGateway.getInstance();

describe('createAccountAsync', () => {
  it('should generate random account', async () => {
    const account = await gateway.createAccountAsync();
    assert(account.address.length > 0);
    assert(account.privateKey.length > 0);
  });
});
