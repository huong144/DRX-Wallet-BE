import { EntityManager } from 'typeorm';
import { Withdrawal, WithdrawalLog } from '../entities';
import { getLogger, Utils } from 'sota-common';
import { WithdrawalEvent } from '../Enums';

const logger = getLogger('rawdb::insertWithdrawalLog');

/**
 * Everytime an event happens and need to notify to client, one or some webhook progresses are created
 * There will be a webhook processor, which picks the pending progress records and dispatch them to target urls later
 *
 * @param {EntityManager} manager
 * @param {number} userId
 * @param {number} refId - the ID of deposit or withdrawal, corresponding to the type
 * @param {string} event -
 */
export async function insertWithdrawalLog(
  manager: EntityManager,
  txid: string,
  refId: number,
  event: WithdrawalEvent,
  data?: string
): Promise<void> {
  // Find out all user webhooks first
  const withdrawals = await manager.getRepository(Withdrawal).find({ txid });

  // Construct the records
  const logRecords = withdrawals.map(withdrawal => {
    const record = new WithdrawalLog();
    record.withdrawalId = withdrawal.id;
    record.event = event;
    record.refId = refId;
    record.createdAt = Utils.nowInMillis();

    if (data) {
      record.data = data;
    }

    return record;
  });

  // And persist them to database
  await manager.getRepository(WithdrawalLog).save(logRecords);

  logger.info(`Created withdrawal log: txid=${txid}, refId=${refId}, event=${event}`);
  return;
}

export default insertWithdrawalLog;
