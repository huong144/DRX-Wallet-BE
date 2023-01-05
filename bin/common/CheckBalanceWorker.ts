import 'sota-common';
import { prepareEnvironment } from 'wallet-core';
import { CheckBalanceProcessor } from 'wallet-core/src/CheckBalanceProcessor';

prepareEnvironment()
  .then(start)
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

function start(): void {
  const worker = new CheckBalanceProcessor();
  worker.start();
}
