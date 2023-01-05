import 'sota-xrp';
import { ICrawlerOptions } from 'sota-common';
import { prepareEnvironment, callbacks } from 'wallet-core';
import { XrpCrawler, IXrpCrawlerOptions } from 'sota-xrp';

prepareEnvironment()
  .then(start)
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

function start(): void {
  const {
    getLatestCrawledBlockNumber,
    onCrawlingTxs_CheckUpThreshold,
    onBlockCrawled,
    getAddressesDepositCrawler,
  } = callbacks;
  const crawlerOpts: IXrpCrawlerOptions = {
    getLatestCrawledBlockNumber,
    onCrawlingTxs: onCrawlingTxs_CheckUpThreshold,
    onBlockCrawled,
    getAddressesDepositCrawler,
  };

  const crawler = new XrpCrawler(crawlerOpts);
  crawler.start();
}
