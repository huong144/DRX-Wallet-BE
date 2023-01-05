import { BaseCrawler, Transaction, getLogger } from 'sota-common';

const logger = getLogger('Callback.onTxCrawled');

export default async function onTxCrawled(crawler: BaseCrawler, tx: Transaction): Promise<void> {
  logger.info('on method invoked: onTxCrawled');
}

export { onTxCrawled };
