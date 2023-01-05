import { BasePlatformCrawler, BlockchainPlatform, ICrawlerOptions } from 'sota-common';

export class BscCrawler extends BasePlatformCrawler {
  protected _processingTimeout: number = 30000;
  constructor(options: ICrawlerOptions) {
    super(BlockchainPlatform.BSC, options);
    console.log(options);
  }
}

export default BscCrawler;
