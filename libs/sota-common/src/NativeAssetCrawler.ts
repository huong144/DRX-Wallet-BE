import { BaseCrawler, getLogger } from '..';

const logger = getLogger('CustomAssetCrawler');
/**
 * Token means custom assets, not the native ones
 * Like ERC20 tokens on Ethereum platform, Omni assets on Bitcoin platform, ...
 */

export abstract class NativeAssetCrawler extends BaseCrawler {
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
    const c = this._nativeCurrency;
    logger.info(`${c.symbol}::processBlocks BEGIN: ${fromBlockNumber}→${toBlockNumber} / ${latestNetworkBlock}`);
    const gateway = this.getPlatformGateway();

    // Get all transactions in the block
    const allTxs = await gateway.getMultiBlocksTransactions(fromBlockNumber, toBlockNumber);

    // Use callback to process all crawled transactions
    await this._options.onCrawlingTxs(this, allTxs);

    logger.info(`${c.symbol}::processBlocks FINISH: ${fromBlockNumber}→${toBlockNumber}, txs=${allTxs.length}`);
  }
}
