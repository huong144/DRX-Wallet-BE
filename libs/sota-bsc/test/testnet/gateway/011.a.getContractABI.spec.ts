import { assert } from 'chai';
import Contract from 'web3/eth/contract';
import { BscGateway } from '../../..';
import { Currency, TokenType } from 'sota-common';
import { callbacks } from 'wallet-core';

describe('EthGateway::test-get-abi', () => {
  it('Check ABI', async () => {
    callbacks
      .prepareCurrencyWorker(Currency.Ethereum, TokenType.ERC20)
      .then(async () => {
        const eth = BscGateway.getInstance('0x0000000000085d4780B73119b644AE5ecd22b376') as BscGateway;
        const contract: Contract = eth.getContractABI('0x0000000000085d4780B73119b644AE5ecd22b376');
        console.log((contract as any).methods.balanceOf('0x0000000000085d4780B73119b644AE5ecd22b376').call());
        console.log(await (contract as any).methods.decimals().call());
        console.log((await (contract as any).methods.symbol().call()).toLowerCase());
        console.log(await (contract as any).methods.name().call());
      })
      .catch(err => {
        console.error(err);
        process.exit(1);
      });
  });
});
