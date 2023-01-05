import { ICrawlerOptions, BaseCrawler, Transactions } from 'sota-common';
import { XrpCrawler } from './XrpCrawler';
export interface IXrpCrawlerOptions extends ICrawlerOptions {
  readonly getAddressesDepositCrawler: (crawler: XrpCrawler) => Promise<string[]>;
}
