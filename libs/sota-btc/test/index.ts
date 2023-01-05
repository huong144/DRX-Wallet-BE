import 'sota-common';

import requireDir from 'require-dir';
import { BlockchainPlatform, CurrencyRegistry } from 'sota-common';
const network = process.env.NETWORK;

doPrepare();

requireDir(`./${network}/gateway`);

// require(`./${network}/gateway/003.getOneTransaction.spec`);

function doPrepare() {
  const bitcoin = CurrencyRegistry.getOneNativeCurrency(BlockchainPlatform.Bitcoin);
  CurrencyRegistry.setCurrencyConfig(bitcoin, {
    currency: 'btc',
    network: 'testnet',
    chainId: 'test',
    chainName: 'test',
    averageBlockTime: 60000,
    requiredConfirmations: 2,
    restEndpoint: '',
    rpcEndpoint: '{"protocol":"","host":"","port":"","user":"","pass":""}',
    explorerEndpoint: '',
    internalEndpoint: '',
  });
}
