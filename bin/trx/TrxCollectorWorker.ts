import 'sota-trx';
import { BaseCoinCollector, prepareEnvironment, callbacks } from 'wallet-core';
import { ICurrencyWorkerOptions, BlockchainPlatform } from 'sota-common';
import { collectorDoProcess } from 'wallet-core/src/callbacks';

prepareEnvironment()
  .then(start)
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

function start(): void {
  const collectorOpts: ICurrencyWorkerOptions = {
    prepare: callbacks.doNothing,
    doProcess: collectorDoProcess,
  };

  const collector = new BaseCoinCollector(BlockchainPlatform.Tron, collectorOpts);
  collector.start();
}
