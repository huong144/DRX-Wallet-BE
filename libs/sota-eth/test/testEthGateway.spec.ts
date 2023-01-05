import * as _ from 'lodash';
import EthGateway from '../src/EthGateway';
import { expect, assert } from 'chai';
import { TransactionStatus } from 'sota-common';

describe('EthGateway::test-create-account', () => {
  const eth = EthGateway.getInstance();
  it('Create account', async () => {
    const account = await eth.createAccountAsync();
    assert.exists(account);
  });
});

describe('EthGateway::test-get-one-transaction', () => {
  const eth = EthGateway.getInstance();
  it('Return transaction info if txid valid', async () => {
    const tx = await eth.getOneTransaction('0x2de03b4e82e3869402677c14d497e48dc7065819c4b69ae9531bafad6f4c73ed');
    assert.equal(tx.txid, '0x2de03b4e82e3869402677c14d497e48dc7065819c4b69ae9531bafad6f4c73ed');
  });

  it('Return null if unknown transaction', async () => {
    const tx = await eth.getOneTransaction('0x1111111111111111111111111111111111111111111111111111111111111111');
    assert.equal(tx, null);
  });

  it('Throw error if txid invalid', async () => {
    let error;
    try {
      const tx = await eth.getOneTransaction('abc');
    } catch (err) {
      error = err;
    }
    expect(error).to.exist.and.be.instanceof(Error);
  });
});

describe('EthGateway::test-get-transaction-by-ids', () => {
  const eth = EthGateway.getInstance();
  it('Return transaction array with txids valid', async () => {
    const txids = [
      '0x2de03b4e82e3869402677c14d497e48dc7065819c4b69ae9531bafad6f4c73ed',
      '0x80854cb247f13a86cbaff7ec5b35cd784c0d38556ea694c8d05bf73b94d41312',
      '0x7a45ddb19524c709ee2593c63708ee89f42dfa416ad62ba6299dec41898b3816',
    ];
    const txs = await eth.getTransactionsByIds(txids);
    assert.equal(txs.length, 3);
  });

  it('If txids have element invalid, txs have element null', async () => {
    const txids = [
      '0x2de03b4e82e3869402677c14d497e48dc7065819c4b69ae9531bafad6f4c73ed',
      '0x1111111111111111111111111111111111111111111111111111111111111111',
      '0x7a45ddb19524c709ee2593c63708ee89f42dfa416ad62ba6299dec41898b3816',
    ];
    const txs = await eth.getTransactionsByIds(txids);
    const filterTxs = _.compact(txs);
    assert.equal(filterTxs.length, 2);
  });

  it('Throw error if txids have element malformed', async () => {
    const txids = [
      '0x2de03b4e82e3869402677c14d497e48dc7065819c4b69ae9531bafad6f4c73ed',
      '111111111111111111111111111111111111111111111111111111111111111111',
      '0x7a45ddb19524c709ee2593c63708ee89f42dfa416ad62ba6299dec41898b3816',
    ];
    let error;
    try {
      const txs = await eth.getTransactionsByIds(txids);
    } catch (err) {
      error = err;
    }
    expect(error).to.exist.and.be.instanceof(Error);
  });
});

describe('EthGateway::test-get-one-block', () => {
  const eth = EthGateway.getInstance();
  it('Return block info if block number valid', async () => {
    const block = await eth.getOneBlock(3590100);
    assert.exists(block);
  });

  it('Return null if block number not exist', async () => {
    const block = await eth.getOneBlock(10000000000);
    assert.equal(block, null);
  });

  it('Throw error if block number invalid', async () => {
    let error;
    try {
      const block = await eth.getOneBlock('abc');
    } catch (err) {
      error = err;
    }
    expect(error).to.exist.and.be.instanceof(Error);
  });
});

describe('EthGateway::test-get-block-count', () => {
  const eth = EthGateway.getInstance();
  it('Return block count', async () => {
    const count = await eth.getBlockCount();
    assert(count > 0);
  });
});

describe('EthGateway::test-get-block-transactions', () => {
  const eth = EthGateway.getInstance();
  it('Return txs of block', async () => {
    const txs = await eth.getBlockTransactions(3590100);
    assert(txs.length > 0);
  });

  it('Throw error if block not exist', async () => {
    let error;
    try {
      const txs = await eth.getBlockTransactions(100000000);
    } catch (err) {
      error = err;
    }
    expect(error).to.exist.and.be.instanceof(Error);
  });

  it('Throw error if block number invalid', async () => {
    let error;
    try {
      const txs = await eth.getBlockTransactions('abc');
    } catch (err) {
      error = err;
    }
    expect(error).to.exist.and.be.instanceof(Error);
  });
});

describe('EthGateway::test-get-multi-block-transactions', () => {
  const eth = EthGateway.getInstance();
  it('Return txs from block a to block b', async () => {
    const txs = await eth.getMultiBlocksTransactions(3590100, 3590105);
    assert.exists(txs);
  });

  it('Throw error if block start less than block end', async () => {
    let error;
    try {
      const txs = await eth.getMultiBlocksTransactions(3590105, 3590100);
    } catch (err) {
      error = err;
    }
    expect(error).exist.and.be.instanceof(Error);
  });
});

describe('EthGateway::test-get-address-balance', () => {
  const eth = EthGateway.getInstance();
  it('Return balance of account', async () => {
    const balance = await eth.getAddressBalance('0xe8132179d9181da72109CD65BE6ad9B4F2a99A8B');
    assert.exists(balance);
  });

  it('Throw error if address invalid', async () => {
    let error;
    try {
      const balance = await eth.getAddressBalance('111111111111111111111111111111111111111111');
    } catch (err) {
      error = err;
    }
    expect(error).to.exist.and.be.instanceof(Error);
  });
});

describe('EthGateway::test-get-transaction-status', () => {
  const eth = EthGateway.getInstance();
  it('Return UNKNOWN if txid invalid', async () => {
    const result = await eth.getTransactionStatus('0x1111111111111111111111111111111111111111111111111111111111111111');
    assert.equal(result, TransactionStatus.UNKNOWN);
  });

  it('Return COMPLETED if txid valid and enought confirmation', async () => {
    const result = await eth.getTransactionStatus('0x2de03b4e82e3869402677c14d497e48dc7065819c4b69ae9531bafad6f4c73ed');
    assert.equal(result, TransactionStatus.COMPLETED);
  });
});

describe('EthGateway::createRawTransaction', () => {
  const gateway = EthGateway.getInstance();
  it('Create valid raw transaction', async () => {
    const fromAddress = '0x0d496aaDD275ddc6E3dAeE4c2b632e32F7A80Bb8';
    const vout = {
      toAddress: '0xDD92809A181E3f51C5C57271477cBD33Cd9ac7E5',
      amount: '10000',
    };
    const result = await gateway.createRawTransaction(fromAddress, [vout]);
    assert.exists(result);
  });
});

describe('EthGateway::test-sign-raw-tx-by-singer-private-key', () => {
  const gateway = EthGateway.getInstance();
  it('Sign transaction valid', async () => {
    const fromAddress = '0x0d496aaDD275ddc6E3dAeE4c2b632e32F7A80Bb8';
    const privateKey = 'B15D1288C2AD3DC725582B189E6383D088A29E7DAA9AB6E029BEF5C619AB13FC';
    const vout = {
      toAddress: '0xDD92809A181E3f51C5C57271477cBD33Cd9ac7E5',
      amount: '10000',
    };
    const unsignedRaw = await gateway.createRawTransaction(fromAddress, [vout]);
    const signedRaw = await gateway.signRawTxByPrivateKey(unsignedRaw.unsignedRaw, privateKey);
    assert.exists(signedRaw.txid);
  });
});

describe('EthGateway::test-send-raw-transaction', () => {
  const gateway = EthGateway.getInstance();
  it('Send raw transaction', async () => {
    const fromAddress = '0x0d496aaDD275ddc6E3dAeE4c2b632e32F7A80Bb8';
    const privateKey = 'B15D1288C2AD3DC725582B189E6383D088A29E7DAA9AB6E029BEF5C619AB13FC';
    const vout = {
      toAddress: '0xDD92809A181E3f51C5C57271477cBD33Cd9ac7E5',
      amount: '10000',
    };
    const unsignedRaw = await gateway.createRawTransaction(fromAddress, [vout]);
    const signedRaw = await gateway.signRawTxByPrivateKey(unsignedRaw.unsignedRaw, privateKey);
    const sendTx = await gateway.sendRawTransaction(signedRaw.signedRaw);
    assert.exists(sendTx.txid);
  });
});
