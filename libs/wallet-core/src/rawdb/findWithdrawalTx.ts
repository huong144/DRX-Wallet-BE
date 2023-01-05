import { WithdrawalTx } from '../entities';
import { EntityManager, In } from 'typeorm';
import { WithdrawalStatus } from '../Enums';

export async function findOneWithdrawalTx(
  manager: EntityManager,
  currencies: string | string[],
  statuses: WithdrawalStatus | WithdrawalStatus[]
): Promise<WithdrawalTx> {
  // Find wallet of record
  return await manager.findOne(WithdrawalTx, {
    order: { updatedAt: 'ASC' },
    where: {
      currency: Array.isArray(currencies) ? In(currencies) : currencies,
      status: Array.isArray(statuses) ? In(statuses) : statuses,
    },
  });
}

export async function findOneWithdrawalTxWithId(
  manager: EntityManager,
  currencies: string | string[],
  statuses: WithdrawalStatus | WithdrawalStatus[],
  withdrawalId: number
): Promise<WithdrawalTx> {
  // Find wallet of record
  return await manager.findOne(WithdrawalTx, {
    order: { updatedAt: 'ASC' },
    where: {
      currency: Array.isArray(currencies) ? In(currencies) : currencies,
      status: Array.isArray(statuses) ? In(statuses) : statuses,
      id: withdrawalId,
    },
  });
}
