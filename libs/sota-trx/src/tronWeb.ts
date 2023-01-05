const TronWeb = require('tronweb');
import { CurrencyRegistry, BlockchainPlatform, getLogger } from 'sota-common';

const logger = getLogger('tronWeb');

let tronWeb: any;
// TODO: set the owner address!
// tronWeb.setAddress('TBBDgHiNBmT32WYrcwYk94CBT1FpLkeLyH');

CurrencyRegistry.onCurrencyConfigSet((currency, config) => {
  if (currency.symbol !== BlockchainPlatform.Tron) {
    return;
  }

  logger.info(`tronWeb::onCurrencyConfigSet currency=${currency.symbol} config=${JSON.stringify(config)}`);
  if (!config.restEndpoint) {
    return;
  }

  const restEndpointConfig = JSON.parse(config.restEndpoint);

  tronWeb = new TronWeb({
    fullHost: restEndpointConfig.trongrid_url,
    headers: { 'TRON-PRO-API-KEY': restEndpointConfig.api_key },
  });
});

export { tronWeb };
