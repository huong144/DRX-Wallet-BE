import { EntityManager } from 'typeorm';
import { Deposit, DepositLog, Wallet } from '../entities';
import { Utils } from 'sota-common';
import { DepositEvent, WebhookType } from '../Enums';
import { insertWebhookProgress } from './insertWebhookProgress';

/**
 * insertDepositLog is called when deposit has any update
 *
 * @param {EntityManager} manager
 * @param {number} depositId - id of deposit record
 * @param {string} event - what has just happened with the deposit
 * @param {number} refId - id of deposit record
 */
export async function insertDepositLog(
  manager: EntityManager,
  depositId: number,
  event: DepositEvent,
  refId?: number,
  userId?: number
): Promise<void> {
  // Find wallet of record
  if (!userId) {
    const deposit = await manager.findOneOrFail(Deposit, { id: depositId });
    const wallet = await manager.getRepository(Wallet).findOneOrFail({ id: deposit.walletId });
    userId = wallet.userId;
  }

  // Construct log data
  const record = new DepositLog();
  record.depositId = depositId;
  record.event = event;
  record.refId = refId ? refId : depositId;
  record.createdAt = Utils.nowInMillis();

  // Persist log record into database, and also the webhook progress
  await Utils.PromiseAll([
    manager.getRepository(DepositLog).save(record),
    insertWebhookProgress(manager, userId, WebhookType.DEPOSIT, depositId, event),
  ]);

  return;
}
