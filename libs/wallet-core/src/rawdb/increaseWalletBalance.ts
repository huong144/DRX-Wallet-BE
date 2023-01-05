import { EntityManager } from 'typeorm';
import { WalletBalance } from '../entities';
import { Utils, BigNumber } from 'sota-common';

/**
 * Increase wallet balance due to incoming deposit
 *
 */
export async function increaseWalletBalance(
  manager: EntityManager,
  walletId: number,
  currency: string,
  amount: BigNumber
): Promise<void> {
  await manager
    .createQueryBuilder()
    .update(WalletBalance)
    .set({ balance: () => `balance + ${amount.toString()}`, updatedAt: Utils.nowInMillis() })
    .where({ currency, walletId })
    .execute();

  return;
}

export default increaseWalletBalance;
