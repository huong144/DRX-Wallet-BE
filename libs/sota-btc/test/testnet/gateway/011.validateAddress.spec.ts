import assert from 'assert';
import { BtcGateway } from '../../../src/BtcGateway';

describe('checkAccount', () => {
  it('check bitcoin account', async () => {
    await testCheckAccount();
  });
});

async function testCheckAccount() {
  try {
    const gateway: BtcGateway = BtcGateway.getInstance();
    const account: boolean = await gateway.isValidAddressAsync('mnMSQs3HZ5zhJrCEKbqGvcDLjAAxvDJDCd');
    assert(account);
    const failedWithMainNetAddress: boolean = await gateway.isValidAddressAsync('14J5Q7ageKhM3miKd94DX44Kf6b7ko4BZe');
    assert.equal(failedWithMainNetAddress, false);
    const failAccount: boolean = await gateway.isValidAddressAsync('yuubaniraimaasa');
    assert.equal(failAccount, false);
  } catch (e) {
    throw e;
  }
}
