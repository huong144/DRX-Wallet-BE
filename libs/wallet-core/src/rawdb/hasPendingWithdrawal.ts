import { WithdrawalTx } from '../entities';
import { EntityManager, In } from 'typeorm';
import { WithdrawalStatus } from '../Enums';

export async function hasPendingWithdrawal(manager: EntityManager, currency: string): Promise<boolean> {
  // TODO: filter by hot wallet
  const pendingStatuses = [WithdrawalStatus.SENT, WithdrawalStatus.SIGNED, WithdrawalStatus.SIGNING];
  const pendingRecord = await manager.getRepository(WithdrawalTx).findOne({
    currency,
    status: In(pendingStatuses),
  });

  return !!pendingRecord;
}
