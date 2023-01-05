import Web3 from 'web3';
import { EnvConfigRegistry, NetworkType, CurrencyRegistry, BlockchainPlatform, getLogger } from 'sota-common';

const logger = getLogger('web3');

const web3 = new Web3();
const infuraWeb3 = new Web3();

EnvConfigRegistry.onNetworkChanged(network => {
  logger.info(`web3::onNetworkChanged network=${network}`);
  if (network === NetworkType.MainNet) {
    const provider = new Web3.providers.HttpProvider('https://mainnet.infura.io/v3/cbc0dce4b2174caabf7ed0c4865920ff');
    web3.setProvider(provider);
    infuraWeb3.setProvider(provider);
    return;
  }

  if (network === NetworkType.TestNet) {
    const provider = new Web3.providers.HttpProvider('https://goerli.infura.io/v3/cbc0dce4b2174caabf7ed0c4865920ff');
    web3.setProvider(provider);
    infuraWeb3.setProvider(provider);
    return;
  }
});

CurrencyRegistry.onCurrencyConfigSet((currency, config) => {
  if (currency.symbol !== BlockchainPlatform.Ethereum) {
    return;
  }

  logger.info(`web3::onCurrencyConfigSet currency=${currency.symbol} config=${JSON.stringify(config)}`);
  if (!config.restEndpoint) {
    return;
  }

  web3.setProvider(new Web3.providers.HttpProvider(config.restEndpoint));
});

export { web3, infuraWeb3 };
