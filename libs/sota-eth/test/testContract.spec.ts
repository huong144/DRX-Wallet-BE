import { assert } from 'chai';
import Contract from 'web3/eth/contract';
import { EthGateway } from '..';
import { callbacks } from '../../wallet-core';
import { Currency, TokenType } from '../../sota-common';
import { web3 } from '../src/web3';

describe('EthGateway::test-get-past-event', () => {
  it('Create account', async () => {
    callbacks
      .prepareCurrencyWorker(Currency.Ethereum, TokenType.ERC20)
      .then(async () => {
        const eth = EthGateway.getInstance('0x0000000000085d4780B73119b644AE5ecd22b376') as EthGateway;
        const contract: Contract = eth.getContractABI('0x0000000000085d4780B73119b644AE5ecd22b376');
        const [events] = await Promise.all([
          await contract.getPastEvents('Transfer', { fromBlock: 7006001, toBlock: 7007000 }),
        ]);
        events.map(async ev => {
          const [tx, receipt] = await Promise.all([
            web3.eth.getTransaction(ev.transactionHash),
            web3.eth.getTransactionReceipt(ev.transactionHash),
          ]);
          if (tx.to === '0x8dd5fbCe2F6a956C3022bA3663759011Dd51e73E') {
            console.log(JSON.stringify(ev));
          }
        });
      })
      .catch(err => {
        console.error(err);
        process.exit(1);
      });
  });
});
