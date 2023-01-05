import { EntityManager, In } from 'typeorm';
import { WithdrawalStatus } from '../Enums';
import { InternalTransfer } from '../entities/InternalTransfer';

export async function findOneInternalTransferByCollectStatus(
  manager: EntityManager,
  currencies: string | string[],
  statuses: WithdrawalStatus | WithdrawalStatus[]
): Promise<InternalTransfer> {
  return manager.findOne(InternalTransfer, {
    order: { updatedAt: 'ASC' },
    where: {
      currency: Array.isArray(currencies) ? In(currencies) : currencies,
      status: Array.isArray(statuses) ? In(statuses) : statuses,
    },
  });
}

export default findOneInternalTransferByCollectStatus;
