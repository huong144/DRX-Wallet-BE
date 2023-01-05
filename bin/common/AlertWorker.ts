import 'sota-common';
import { prepareEnvironment } from 'wallet-core';
import { getLogger } from 'sota-common';
import { AlertProcess } from 'wallet-core/src/AlertProcess';

prepareEnvironment()
  .then(start)
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
function start() {
  const worker = new AlertProcess();
  worker.start();
}
