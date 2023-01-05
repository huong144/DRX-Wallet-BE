import { EntityManager, In } from 'typeorm';
import { getLogger, Utils } from 'sota-common';
import { BaseCrawler, Transaction } from 'sota-common';
import insertDeposit from './insertDeposit';
import { Address, HotWallet, InternalTransfer } from '../entities';
import * as rawdb from '../rawdb';

const logger = getLogger('processOneDepositTransaction');

/**
 * Process one deposit transaction
 */
export async function processOneDepositTransaction(
  manager: EntityManager,
  crawler: BaseCrawler,
  tx: Transaction,
  watchingAddresses: string[]
): Promise<void> {
  // Extract transfer outputs from transaction that we care
  const outputs = tx.extractOutputEntries().filter(output => watchingAddresses.indexOf(output.address) > -1);

  // If there's no output we care, just do nothing
  if (!outputs.length) {
    return;
  }

  // TODO: maybe we still need to call webhook for notifying about transaction that is not confirmed?
  // callWebhookOnce(...);

  // If transaction is not confirmed, also do nothing
  const requiredConfirmations = crawler.getRequiredConfirmations();
  const isTxConfirmed = tx.confirmations >= requiredConfirmations;
  if (!isTxConfirmed) {
    logger.info(`Tx ${tx.txid} doesn't have enough confirmations: ${tx.confirmations}`);
    return;
  }

  // internal tx process
  if (await isInternalTransfer(manager, tx)) {
    logger.info(`Tx ${tx.txid} is a internal tx, will not write to deposit`);
    return;
  }

  await Utils.PromiseAll(outputs.map(async output => insertDeposit(manager, output)));
}

/**
 * If a transaction have sender addresses that existed in address table, and hot wallet table
 * so that is internal transfer transaction
 * @param manager
 * @param tx
 */
async function isInternalTransfer(manager: EntityManager, tx: Transaction): Promise<boolean> {
  // Looking for the internal transfer table
  const internalTx = await manager.getRepository(InternalTransfer).findOne({ txid: tx.txid });
  if (internalTx) {
    return true;
  }

  const senderAddresses: string[] = tx.extractSenderAddresses();
  if (!senderAddresses.length) {
    return false;
  }

  const addressRecord = await manager.getRepository(Address).findOne({ address: In(senderAddresses) });
  if (addressRecord) {
    logger.error(`Tx ${tx.txid} is sent from an internal address, but it's not in internal transfer table.`);
    return true;
  }

  const hotAddressRecord = await manager.getRepository(HotWallet).findOne({ address: In(senderAddresses) });
  if (hotAddressRecord) {
    logger.error(`Tx ${tx.txid} is sent from an internal hotwallet, but it's not in internal transfer table.`);
    return true;
  }

  return false;
}

export default processOneDepositTransaction;
