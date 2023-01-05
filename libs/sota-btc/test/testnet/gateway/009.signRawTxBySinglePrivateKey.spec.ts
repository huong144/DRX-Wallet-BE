import BtcGateway from '../../../src/BtcGateway';
import assert from 'assert';

const gateway = BtcGateway.getInstance();

describe('signRawTxByPrivateKey', () => {
  it('should sign raw data with a private key', async () => {
    // signResult
    const signResult = await gateway.signRawTransaction(
      '{"hash":"fd67a0112393388dcb88df3eacae9dd825748480af521cafbd4fbdf49db5145c","version":1,"inputs":[{"prevTxId":"4b4fc64fd7c917c41994f4a95ff0e4136f0b5e6eb04ee545228c664f9fe0266a","outputIndex":1,"sequenceNumber":4294967295,"script":"","scriptString":"","output":{"satoshis":9879391,"script":"76a9143f8d8ad2fa4d92068218c7534d7798af932f70f088ac"}}],"outputs":[{"satoshis":50,"script":"76a91413889d6b33f9a9e56031090796d8920aff85843388ac"},{"satoshis":9877091,"script":"76a9143f8d8ad2fa4d92068218c7534d7798af932f70f088ac"}],"nLockTime":0,"changeScript":"OP_DUP OP_HASH160 20 0x3f8d8ad2fa4d92068218c7534d7798af932f70f0 OP_EQUALVERIFY OP_CHECKSIG","changeIndex":1,"fee":2250}',
      'cPCPLorCRiTR1ir17BcPmK2sdBFfBA2YdW6mGp3tJeNS1sRNrMfF'
    );
    assert(signResult.signedRaw.length > 0);
    assert(signResult.txid.length > 0);

    try {
      // wrong unsignedRaw
      await gateway.signRawTransaction(
        '{"haeacae9dd825748480af521cafbd4fbdf49db5145c","version":1,"inputs":[{"prevTxId":"4b4fc64fd7c917c41994f4a95ff0e4136f0b5e6eb04ee545228c664f9fe0266a","outputIndex":1,"sequenceNumber":4294967295,"script":"","scriptString":"","output":{"satoshis":9879391,"script":"76a9143f8d8ad2fa4d92068218c7534d7798af932f70f088ac"}}],"outputs":[{"satoshis":50,"script":"76a91413889d6b33f9a9e56031090796d8920aff85843388ac"},{"satoshis":9877091,"script":"76a9143f8d8ad2fa4d92068218c7534d7798af932f70f088ac"}],"nLockTime":0,"changeScript":"OP_DUP OP_HASH160 20 0x3f8d8ad2fa4d92068218c7534d7798af932f70f0 OP_EQUALVERIFY OP_CHECKSIG","changeIndex":1,"fee":2250}',
        'cPCPLorCRiTR1ir17BcPmK2sdBFfBA2YdW6mGp3tJeNS1sRNrMfF'
      );
    } catch (e) {
      assert(e.message === `Couldn't sign raw tx because of wrong unsignedRaw`);
    }

    try {
      // wrong privateKey
      await gateway.signRawTransaction(
        '{"hash":"fd67a0112393388dcb88df3eacae9dd825748480af521cafbd4fbdf49db5145c","version":1,"inputs":[{"prevTxId":"4b4fc64fd7c917c41994f4a95ff0e4136f0b5e6eb04ee545228c664f9fe0266a","outputIndex":1,"sequenceNumber":4294967295,"script":"","scriptString":"","output":{"satoshis":9879391,"script":"76a9143f8d8ad2fa4d92068218c7534d7798af932f70f088ac"}}],"outputs":[{"satoshis":50,"script":"76a91413889d6b33f9a9e56031090796d8920aff85843388ac"},{"satoshis":9877091,"script":"76a9143f8d8ad2fa4d92068218c7534d7798af932f70f088ac"}],"nLockTime":0,"changeScript":"OP_DUP OP_HASH160 20 0x3f8d8ad2fa4d92068218c7534d7798af932f70f0 OP_EQUALVERIFY OP_CHECKSIG","changeIndex":1,"fee":2250}',
        'cPCPLorCRiTR1ir17BcPmK2sdBFfBA2YdW6mGp3t'
      );
    } catch (e) {
      assert(e.message === `Couldn't sign raw tx because of wrong privateKey`);
    }
  });
});
