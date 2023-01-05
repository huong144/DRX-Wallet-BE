import { BasePlatformCrawler, BlockchainPlatform, ICrawlerOptions } from 'sota-common';

export class EthCrawler extends BasePlatformCrawler {
  protected _processingTimeout: number = 300000;
  constructor(options: ICrawlerOptions) {
    super(BlockchainPlatform.Ethereum, options);
  }
}

export default EthCrawler;
