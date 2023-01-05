import BtcGateway from '../../../src/BtcGateway';
import assert from 'assert';

const gateway = BtcGateway.getInstance();

describe('reconstructRawTx', () => {
  it('should deserialize tx from raw data', async () => {
    const rawTx =
      '{"hash":"17a02b66ee43502df7674b8b4e4422ab2faafef5b64f2c8d5de511a7a036b6e8","version":1,"inputs":[{"prevTxId":"962a766d41655afb613b9fd1081aadf8ffa1922e45c6bb03db9398e9d54aa25b","outputIndex":1,"sequenceNumber":4294967295,"script":"","scriptString":"","output":{"satoshis":9891365,"script":"76a9143f8d8ad2fa4d92068218c7534d7798af932f70f088ac"}}],"outputs":[{"satoshis":13,"script":"76a91413889d6b33f9a9e56031090796d8920aff85843388ac"},{"satoshis":11,"script":"76a91413889d6b33f9a9e56031090796d8920aff85843388ac"},{"satoshis":9,"script":"76a91413889d6b33f9a9e56031090796d8920aff85843388ac"},{"satoshis":9889082,"script":"76a9143f8d8ad2fa4d92068218c7534d7798af932f70f088ac"}],"nLockTime":0,"changeScript":"OP_DUP OP_HASH160 20 0x3f8d8ad2fa4d92068218c7534d7798af932f70f0 OP_EQUALVERIFY OP_CHECKSIG","changeIndex":3,"fee":2250}';
    const tx = gateway.reconstructRawTx(rawTx);
    assert.equal(tx.txid, '17a02b66ee43502df7674b8b4e4422ab2faafef5b64f2c8d5de511a7a036b6e8');
    assert.equal(tx.unsignedRaw, rawTx);
  });
});
