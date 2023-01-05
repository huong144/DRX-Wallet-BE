import { WithdrawalTx } from '../entities';
import { EntityManager, In } from 'typeorm';
import { WithdrawalStatus } from '../Enums';

export async function findWithdrawalTxByStatus(
  manager: EntityManager,
  currency: string,
  status: WithdrawalStatus[]
): Promise<WithdrawalTx> {
  // Find wallet of record
  return await manager.findOne(WithdrawalTx, {
    currency,
    status: In(status),
  });
}
