import { Withdrawal } from '../entities';
import { EntityManager, In } from 'typeorm';
import { WithdrawalStatus, WithdrawalNote, CollectStatus, InternalTransferType } from '../Enums';

export async function findTotalAmountWithdrawlPending(currency: string, manager: EntityManager): Promise<string> {
  const withdrawal = 'Withdrawal';
  return (
    (await manager
      .getRepository(Withdrawal)
      .createQueryBuilder(withdrawal)
      .select(`SUM(${withdrawal}.amount)`, 'totalWithdrawalPending')
      .where(`${withdrawal}.currency = :currency`, { currency: `${currency}` })
      .andWhere(`${withdrawal}.status IN (:...statuses)`, {
        statuses: [
          `${WithdrawalStatus.SIGNED}`,
          `${WithdrawalStatus.SENT}`,
          `${WithdrawalStatus.SIGNING}`,
          `${WithdrawalStatus.UNSIGNED}`,
        ],
      })
      .getRawOne()).totalWithdrawalPending || 0
  );
}
