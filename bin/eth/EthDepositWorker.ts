import 'sota-eth';
import { ICrawlerOptions } from 'sota-common';
import { prepareEnvironment, callbacks } from 'wallet-core';
import { EthCrawler } from 'sota-eth';
prepareEnvironment()
  .then(start)
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

function start(): void {
  const { getLatestCrawledBlockNumber, onCrawlingTxs, onBlockCrawled } = callbacks;
  const crawlerOpts: ICrawlerOptions = {
    getLatestCrawledBlockNumber,
    onCrawlingTxs,
    onBlockCrawled,
  };

  const crawler = new EthCrawler(crawlerOpts);
  crawler.start();
}
