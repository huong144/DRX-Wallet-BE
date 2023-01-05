import { BasePlatformCrawler, BlockchainPlatform, ICrawlerOptions } from 'sota-common';

export class PolygonCrawler extends BasePlatformCrawler {
  protected _processingTimeout: number = 300000;
  constructor(options: ICrawlerOptions) {
    super(BlockchainPlatform.Polygon, options);
  }
}

export default PolygonCrawler;
