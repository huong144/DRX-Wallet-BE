import 'sota-sol';
import { prepareEnvironment, callbacks } from 'wallet-core';
import { BaseCurrencyWorker, ICurrencyWorkerOptions, CurrencyRegistry } from 'sota-common';
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
  const crawler = new BaseCurrencyWorker(CurrencyRegistry.Solana, crawlerOpts);
  crawler.start();
}
