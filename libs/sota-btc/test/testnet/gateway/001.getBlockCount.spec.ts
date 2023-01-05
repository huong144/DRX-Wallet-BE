import BtcGateway from '../../../src/BtcGateway';
import assert from 'assert';

const gateway = BtcGateway.getInstance();

describe('getBlockCount', () => {
  it('should get block count as non-zero number', async () => {
    const blockCount = await gateway.getBlockCount();
    assert(blockCount > 0);
  });
});

// describe('test_get_block_tx', () => {
//   it('should get block tx', done => {
//     const btc = BtcGateway.getInstance();
//     btc
//       .getBlockTransactions(1)
//       .then(data => {
//         console.log('Txs: ', data);
//         assert.notEqual(data, null);
//         done();
//       })
//       .catch(err => {
//         console.log(err);
//         assert.ifError(err);
//         done(err);
//       });
//   });
// });

// describe('test_get_multi_block_tx', () => {
//   it('should get multi block tx', done => {
//     const btc = BtcGateway.getInstance();
//     btc
//       .getMultiBlocksTransactions(1, 20)
//       .then(data => {
//         console.log('Txs: ', data);
//         assert.notEqual(data, 0);
//         done();
//       })
//       .catch(err => {
//         console.log(err);
//         done(err);
//       });
//   });
// });

// describe('test_check_transaction_confirmed', () => {
//   it('should check confirmation of tx', done => {
//     const btc = BtcGateway.getInstance();
//     btc
//       .isTransactionConfirmed('f0315ffc38709d70ad5647e22048358dd3745f3ce3874223c80a7c92fab0c8ba')
//       .then(data => {
//         console.log('Check: ', data);
//         assert.notEqual(data, false);
//         done();
//       })
//       .catch(err => {
//         console.log(err);
//         done(err);
//       });
//   });
// });
