import { EntityManager } from 'typeorm';
import { WithdrawalTx } from '../entities';
import { getLogger, Utils } from 'sota-common';

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
export async function insertWithdrawalTx(manager: EntityManager, withdrawalTx: WithdrawalTx): Promise<WithdrawalTx> {
  // And persist them to database
  withdrawalTx.createdAt = Utils.nowInMillis();
  withdrawalTx.updatedAt = Utils.nowInMillis();
  const res = await manager.getRepository(WithdrawalTx).save(withdrawalTx);
  return res as WithdrawalTx;
}

export default insertWithdrawalTx;
