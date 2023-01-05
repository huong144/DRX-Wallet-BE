import { getLogger } from 'sota-common';
import { Withdrawal } from '../entities';
import { EntityManager } from 'typeorm';

const logger = getLogger('rawdb::findSentWithdrawal');

export async function findWithdrawalsByStatus(
  manager: EntityManager,
  walletId: number,
  currency: string,
  status: string,
  limit: number
): Promise<Withdrawal[]> {
  // Find wallet of record
  return manager.getRepository(Withdrawal).find({
    order: {
      updatedAt: 'ASC',
    },
    take: limit,
    where: { walletId, currency, status },
  });
}

export default findWithdrawalsByStatus;
