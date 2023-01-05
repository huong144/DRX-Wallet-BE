import 'sota-eth';
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
    doProcess: callbacks.senderDoProcess,
  };
  const crawler = new BaseCurrencyWorker(CurrencyRegistry.Ethereum, crawlerOpts);
  crawler.start();
}
