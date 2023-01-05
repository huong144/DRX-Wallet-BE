import { BasePlatformCrawler, BlockchainPlatform, ICrawlerOptions } from 'sota-common';

export class SolCrawler extends BasePlatformCrawler {
  protected _processingTimeout: number = 30000;
  constructor(options: ICrawlerOptions) {
    super(BlockchainPlatform.Solana, options);
  }
}

export default SolCrawler;
