import 'sota-btc';
import { ICrawlerOptions, BaseIntervalWorker2 } from 'sota-common';
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
    doProcess: callbacks.pickerDoProcess,
  };
  const crawler = new BtcPickerWorker(CurrencyRegistry.Bitcoin, crawlerOpts);
  crawler.start();
}

export class BtcPickerWorker extends BaseCurrencyWorker {
  protected _nextTickTimer: number = 600000;
}
