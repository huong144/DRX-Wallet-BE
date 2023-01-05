import { GenericTransactions, Transaction, BaseCrawler, Transactions, Utils } from 'sota-common';
import { EntityManager, getConnection } from 'typeorm';
import { getLogger } from 'sota-common';
import * as rawdb from '../../rawdb';

const logger = getLogger('onCrawlingTxs_CheckUpThreshold');
/**
 * This callback is invoked to processing all transactions of crawling blocks
 * @param {BaseCrawler} crawler - the crawler that is processing
 * @param {Transactions} allTxs - all transactions that are being crawled and need to process
 *
 * @returns {Transactions} list of transactions that are being watched
 */
export default async function onCrawlingTxs_CheckUpThreshold(
  crawler: BaseCrawler,
  allTxs: Transactions
): Promise<void> {
  const connection = getConnection();
  // Key transactions by hash and address for looking up later
  const txsByAddress = allTxs.groupByRecipients();
  if (!allTxs.length || !txsByAddress.size) {
    return;
  }
  await connection.transaction(async manager => {
    try {
      await _onCrawlingTxs_CheckUpThreshold(manager, crawler, txsByAddress);
    } catch (e) {
      logger.error(`onCrawlingTxs failed with error`);
      logger.error(e);
      throw e;
    }
  });
}

// Proxy function behind the transaction
async function _onCrawlingTxs_CheckUpThreshold(
  manager: EntityManager,
  crawler: BaseCrawler,
  txsByAddress: Map<string, GenericTransactions<Transaction>>
): Promise<void> {
  // Get all addresses that are involved in the transactions
  const allAddresses: string[] = Array.from(txsByAddress.keys());
  const currency = crawler.getNativeCurrency().networkSymbol;

  // Filter out related addresses
  const watchingAddresses = await rawdb.filterWatchingAddresses(manager, allAddresses, currency);

  // Ger related transactions
  const watchingTxs = watchingAddresses.reduce((memo, watchingAddress) => {
    return memo.concat(txsByAddress.get(watchingAddress));
  }, new Transactions());

  const uniqueListTxs = Array.from(new Set(watchingTxs.map((tx: Transaction) => tx)));
  const txProcessed = new Map<string, boolean>();

  // Process every single deposit transaction
  const tasks = uniqueListTxs.map(async watchingTx => {
    if (!watchingTx) {
      return;
    }

    if (watchingTx.isFailed) {
      return;
    }

    // Prevent process one transaction multiple times
    if (txProcessed.get(watchingTx.txid)) {
      return;
    }

    txProcessed.set(watchingTx.txid, true);

    return rawdb.processOneDepositTransactionAnAddress(manager, crawler, watchingTx, watchingAddresses);
  });

  await Utils.PromiseAll(tasks);
}

export { onCrawlingTxs_CheckUpThreshold };
