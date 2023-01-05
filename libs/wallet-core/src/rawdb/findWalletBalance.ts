import { WalletBalance } from '../entities';
import { EntityManager, In } from 'typeorm';

export async function findWalletBalance(
  manager: EntityManager,
  currency: string,
  walletId: number
): Promise<WalletBalance> {
  return await manager.findOne(WalletBalance, {
    where: {
      currency,
      walletId,
    },
  });
}
