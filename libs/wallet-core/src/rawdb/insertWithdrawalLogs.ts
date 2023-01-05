import { EntityManager } from 'typeorm';
import { getLogger, Utils } from 'sota-common';
import { WithdrawalEvent } from '../Enums';
import { WithdrawalLog } from '../entities/WithdrawalLog';

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
export async function insertWithdrawalLogs(
  manager: EntityManager,
  withdrawalIds: number[],
  event: WithdrawalEvent,
  refId: number,
  data: string
): Promise<void> {
  const logRecords = withdrawalIds.map(withdrawalId => {
    return {
      withdrawalId,
      event,
      refId,
      data,
      createdAt: Utils.nowInMillis(),
    };
  });

  // And persist them to database
  await manager.getRepository(WithdrawalLog).save(logRecords);
  return;
}

export default insertWithdrawalLogs;
