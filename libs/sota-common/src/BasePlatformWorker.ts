import { BaseCurrencyWorker } from './BaseCurrencyWorker';
import { BlockchainPlatform } from './enums';
import { ICurrencyWorkerOptions } from './interfaces';
import { CurrencyRegistry } from './registries';

export class BasePlatformWorker extends BaseCurrencyWorker {
  constructor(platform: BlockchainPlatform, options: ICurrencyWorkerOptions) {
    const currency = CurrencyRegistry.getOneNativeCurrency(platform);
    super(currency, options);
  }
}

export default BasePlatformWorker;
