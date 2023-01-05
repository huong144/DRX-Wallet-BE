import BaseCrawler from './BaseCrawler';
import { CurrencyRegistry, GatewayRegistry } from './registries';
import { getLogger } from './Logger';
import * as Utils from './Utils';

const logger = getLogger('BasePlatformCrawler');

export class BasePlatformCrawler extends BaseCrawler {
  /**
   * Process several blocks in one go. Just use single database transaction
   * @param {number} fromBlock - begin of crawling blocks range
   * @param {number} toBlock - end of crawling blocks range
   * @param {number} latestNetworkBlock - recent height of blockchain in the network
   */
  protected async processBlocks(fromBlock: number, toBlock: number, latestNetworkBlock: number) {
    const allCurrencies = CurrencyRegistry.getCurrenciesOfPlatform(this._nativeCurrency.platform);
    await Utils.PromiseAll(
      allCurrencies.map(async c => {
        const gateway = GatewayRegistry.getGatewayInstance(c);

        // Get all transactions in the block
        const allTxs = await gateway.getMultiBlocksTransactions(fromBlock, toBlock);

        // Use callback to process all crawled transactions
        await this._options.onCrawlingTxs(this, allTxs);

        logger.info(
          `${this.constructor.name}::processBlocks FINISH: currency=${c.networkSymbol}` +
            `\tblock=${fromBlock}→${toBlock} / ${latestNetworkBlock}` +
            `\ttxs=${allTxs.length}`
        );
      })
    );
  }
}
