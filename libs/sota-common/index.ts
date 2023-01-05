try {
  require('dotenv-safe').config();
} catch (e) {
  console.error(e.toString());
  process.exit(1);
}

// Make sure the common lib is the only in whole process
if (process.env.isEnvSet_KnV5Ha0UlAAEME69I6KA === '1') {
  throw new Error(`Something went wrong. The [sota-common] lib declared multiple times.`);
}
process.env.isEnvSet_KnV5Ha0UlAAEME69I6KA = '1';

import * as Utils from './src/Utils';
export { Utils };

export { override, implement } from './src/Utils';

export * from './src/types';
export * from './src/enums';
export * from './src/interfaces';
export * from './src/Logger';
export * from './src/BaseIntervalWorker';
export * from './src/BaseIntervalWorker2';
export * from './src/BaseCurrencyWorker';
export * from './src/BasePlatformWorker';
export * from './src/BaseCrawler';
export * from './src/BasePlatformCrawler';
export * from './src/NativeAssetCrawler';
export * from './src/CustomAssetCrawler';
export * from './src/BaseGateway';
export * from './src/AccountBasedGateway';
export * from './src/UTXOBasedGateway';
export * from './src/BitcoinBasedGateway';
export * from './src/BitcoinCashBasedGateway';
export * from './src/BaseMQConsumer';
export * from './src/BaseMQProducer';
export * from './src/BaseWebServer';
export * from './src/RPCClient';
export * from './src/Logger';
export * from './src/RedisChannel';
export * from './src/registries';
export * from './src/SolanaBasedGateway';

// External dependencies
import BigNumber from 'bignumber.js';
export { BigNumber };
