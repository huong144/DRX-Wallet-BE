import {
  BasePlatformCrawler,
  BlockchainPlatform,
  ICrawlerOptions,
  Utils,
  GatewayRegistry,
  CurrencyRegistry,
  override,
  getLogger,
} from 'sota-common';
import { XrpGateway } from './XrpGateway';
import { IXrpCrawlerOptions } from './IXrpCrawlerOptions';

const logger = getLogger('BasePlatformCrawler');

export class XrpCrawler extends BasePlatformCrawler {
  constructor(options: IXrpCrawlerOptions) {
    super(BlockchainPlatform.Ripple, options);
  }

  @override
  public async processBlocks(fromBlock: number, toBlock: number, latestNetworkBlock: number) {
    // const addresses = await this._options.getAddressesDepositCrawler(this);
    const allCurrencies = CurrencyRegistry.getCurrenciesOfPlatform(this._nativeCurrency.platform);
    await Utils.PromiseAll(
      allCurrencies.map(async c => {
        const gateway = GatewayRegistry.getGatewayInstance(c);

        // Get all transactions in the block
        const addresses = await (this._options as IXrpCrawlerOptions).getAddressesDepositCrawler(this);
        const allTxs = await (gateway as XrpGateway).getMultiBlocksTransactionsForAccounts(
          addresses,
          fromBlock,
          toBlock
        );

        // Use callback to process all crawled transactions
        await (this._options as IXrpCrawlerOptions).onCrawlingTxs(this, allTxs);

        logger.info(
          `${this.constructor.name}::processBlocks FINISH: currency=${c.networkSymbol}` +
            `\tblock=${fromBlock}→${toBlock} / ${latestNetworkBlock}` +
            `\ttxs=${allTxs.length}`
        );
      })
    );
  }
}

export default XrpCrawler;
