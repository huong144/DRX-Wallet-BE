import { ICurrency } from './interfaces';
import { getLogger } from './Logger';
import { NativeAssetCrawler } from './NativeAssetCrawler';
import { ICrawlerOptions } from './BaseCrawler';
import { Utils } from '..';
import { BlockchainPlatform } from './enums';
import { GatewayRegistry } from './registries';

const logger = getLogger('CustomAssetCrawler');
/**
 * Token means custom assets, not the native ones
 * Like ERC20 tokens on Ethereum platform, Omni assets on Bitcoin platform, ...
 */

export abstract class CustomAssetCrawler extends NativeAssetCrawler {
  protected readonly _currencies: ICurrency[];

  constructor(options: ICrawlerOptions, currencies: ICurrency[]) {
    if (!currencies.length) {
      throw new Error(`Could not construct a crawler without currency`);
    }

    // The crawler can handle multiple currencies at the same time
    // But they need to belong to the same platform
    let platform: BlockchainPlatform = null;
    for (const currency of currencies) {
      if (!platform) {
        platform = currency.platform;
      }

      if (platform !== currency.platform) {
        throw new Error(`One crawler cannot handle multiple platforms.`);
      }
    }

    super(platform, options);
    this._currencies = currencies;
  }

  /**
   * Process several blocks in one go. Just use single database transaction
   * @param {number} fromBlockNumber - begin of crawling blocks range
   * @param {number} toBlockNumber - end of crawling blocks range
   * @param {number} latestNetworkBlock - recent height of blockchain in the network
   *
   * @returns {number} the highest block that is considered as confirmed
   */
  protected async processBlocks(
    fromBlockNumber: number,
    toBlockNumber: number,
    latestNetworkBlock: number
  ): Promise<void> {
    await Utils.PromiseAll(
      this._currencies.map(async c => {
        logger.info(`${c.symbol}::processBlocks BEGIN: ${fromBlockNumber}→${toBlockNumber} / ${latestNetworkBlock}`);
        const gateway = GatewayRegistry.getGatewayInstance(c);

        // Get all transactions in the block
        const allTxs = await gateway.getMultiBlocksTransactions(fromBlockNumber, toBlockNumber);

        // Use callback to process all crawled transactions
        await this._options.onCrawlingTxs(this, allTxs);

        logger.info(`${c.symbol}::processBlocks FINISH: ${fromBlockNumber}→${toBlockNumber}, txs=${allTxs.length}`);
      })
    );
  }
}
