import { BasePlatformCrawler, BlockchainPlatform, ICrawlerOptions } from 'sota-common';

export class BtcCrawler extends BasePlatformCrawler {
  protected _processingTimeout: number = 300000;
  constructor(options: ICrawlerOptions) {
    super(BlockchainPlatform.Bitcoin, options);
  }
}

export default BtcCrawler;
