import 'sota-btc';
import { NativeAssetCrawler, BlockchainPlatform, ICrawlerOptions } from 'sota-common';
import { prepareEnvironment, callbacks } from 'wallet-core';

class BtcCrawler extends NativeAssetCrawler {
  protected _processingTimeout: number = 300000;
  constructor(options: ICrawlerOptions) {
    super(BlockchainPlatform.Bitcoin, options);
  }
}

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

  const crawler = new BtcCrawler(crawlerOpts);
  crawler.start();
}
