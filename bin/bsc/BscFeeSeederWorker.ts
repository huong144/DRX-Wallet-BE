import 'sota-bsc';
import { ICrawlerOptions } from 'sota-common';
import { prepareEnvironment, callbacks } from 'wallet-core';
import { BaseCurrencyWorker, ICurrency, IOmniAsset, ICurrencyWorkerOptions, CurrencyRegistry } from 'sota-common';
prepareEnvironment()
  .then(start)
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

function start(): void {
  const { doNothing } = callbacks;
  const crawlerOpts: ICurrencyWorkerOptions = {
    prepare: doNothing,
    doProcess: callbacks.feeSeederDoProcess,
  };
  const crawler = new BaseCurrencyWorker(CurrencyRegistry.Bsc, crawlerOpts);
  crawler.start();
}
