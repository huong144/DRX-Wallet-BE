/* eslint-disable no-param-reassign */
// import utils from 'web3';
import Web3 from 'web3';
const utils = require('web3-utils');
const helpers = require('web3-core-helpers');
const formatters = helpers.formatters;
import { EnvConfigRegistry, NetworkType, CurrencyRegistry, BlockchainPlatform, getLogger } from 'sota-common';

const logger = getLogger('web3');

const web3 = new Web3();
const infuraWeb3 = new Web3();

EnvConfigRegistry.onNetworkChanged(network => {
  logger.info(`web3::onNetworkChanged network=${network}`);
  const infuraEnpoint = process.env.INFURA_ENDPOINT;
  if (infuraEnpoint) {
    const provider = new Web3.providers.HttpProvider(infuraEnpoint);
    web3.setProvider(provider);
    infuraWeb3.setProvider(provider);
    return;
  }

  // This implement is for backward compability
  const infuraProjectId = process.env.INFURA_PROJECT_ID;
  if (network === NetworkType.MainNet) {
    const provider = new Web3.providers.HttpProvider(`https://mainnet.infura.io/v3/${infuraProjectId}`);
    web3.setProvider(provider);
    infuraWeb3.setProvider(provider);
    return;
  }

  if (network === NetworkType.TestNet) {
    const provider = new Web3.providers.HttpProvider(`https://polygon-mumbai.infura.io/v3/${infuraProjectId}`);
    web3.setProvider(provider);
    infuraWeb3.setProvider(provider);
    return;
  }
});

CurrencyRegistry.onCurrencyConfigSet((currency, config) => {
  if (currency.symbol !== BlockchainPlatform.Ethereum && currency.platform !== BlockchainPlatform.Polygon) {
    return;
  }

  logger.info(`web3::onCurrencyConfigSet currency=${currency.symbol} config=${JSON.stringify(config)}`);
  if (!config.restEndpoint) {
    return;
  }

  web3.setProvider(new Web3.providers.HttpProvider(config.restEndpoint));
});
// eslint-disable-next-line  @typescript-eslint/no-explicit-any
// const bigGasLimitTransactionFormatter = (tx: any) => {
//   if (tx.blockNumber !== null) {
//     tx.blockNumber = utils.hexToNumber(tx.blockNumber);
//   }
//   if (tx.transactionIndex !== null) {
//     tx.transactionIndex = utils.hexToNumber(tx.transactionIndex);
//   }
//   tx.nonce = utils.hexToNumber(tx.nonce);
//   tx.gas = formatters.outputBigNumberFormatter(tx.gas);
//   tx.gasPrice = formatters.outputBigNumberFormatter(tx.gasPrice);
//   tx.value = formatters.outputBigNumberFormatter(tx.value);
//   if (tx.to && utils.isAddress(tx.to)) {
//     // tx.to could be `0x0` or `null` while contract creation
//     tx.to = utils.toChecksumAddress(tx.to);
//   } else {
//     tx.to = null; // set to `null` if invalid address
//   }
//   if (tx.from) {
//     tx.from = utils.toChecksumAddress(tx.from);
//   }
//   return tx;
// };

// web3.extend({
//   methods: [
//     {
//       name: 'getBigGasLimitTransaction',
//       call: 'eth_getTransactionByHash',
//       params: 1,
//       inputFormatter: [null],
//       outputFormatter: bigGasLimitTransactionFormatter,
//     },
//   ],
// });
export { web3, infuraWeb3 };
