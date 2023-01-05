import { BasePlatformCrawler, BlockchainPlatform, ICrawlerOptions } from 'sota-common';

export class LtcCrawler extends BasePlatformCrawler {
  protected _processingTimeout: number = 300000;
  constructor(options: ICrawlerOptions) {
    super(BlockchainPlatform.Litecoin, options);
  }
}

export default LtcCrawler;
