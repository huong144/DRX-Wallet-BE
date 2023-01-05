import { ICrawlerOptions } from 'sota-common';

export interface IOmniCrawlerOptions extends ICrawlerOptions {
  readonly propertyId: number;
  readonly symbol: string;
  readonly name: string;
}

export default IOmniCrawlerOptions;
