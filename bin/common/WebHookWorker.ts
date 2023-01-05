import 'sota-common';
import { prepareEnvironment, WebhookProcessor } from 'wallet-core';

prepareEnvironment()
  .then(start)
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

function start(): void {
  const worker = new WebhookProcessor();
  worker.start();
}
