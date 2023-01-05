import _ from 'lodash';
import { EntityManager, In } from 'typeorm';
import { Withdrawal } from '../entities';
import { WithdrawalStatus } from '../Enums';
import { BlockchainPlatform as Platform, CurrencyRegistry } from 'sota-common';

/**
 * Determine which withdrawal records will be picked in this round
 * Since we use the same hot wallet for native currency & tokens, there's only 1
 * withdrawal tx is being processed at the same time for each platform, no matter
 * how many different currencies there
 * Withdrawal records are selected need to satisfy:
 * - Has status = `unsigned`
 * - Is not grouped into any withdrawal tx yet
 * - There's no other pending withdrawal tx on the same platform
 *
 * @param manager
 * @param platform
 */
export async function getNextPickedWithdrawals(manager: EntityManager, platform: Platform): Promise<Withdrawal[]> {
  const pendingStatuses = [WithdrawalStatus.SENT, WithdrawalStatus.SIGNED, WithdrawalStatus.SIGNING];
  const platformCurrencies = CurrencyRegistry.getCurrenciesOfPlatform(platform).map(c => c.symbol);
  const pendingCount = await manager
    .getRepository(Withdrawal)
    .createQueryBuilder()
    .where('currency', In(platformCurrencies))
    .andWhere('status', In(pendingStatuses))
    .select('DISTINCT currency')
    .getCount();

  // If there're pending records, just skip this turn and wait until they're all completed
  if (pendingCount > 0) {
    return [];
  }

  const firstRecord = await manager.getRepository(Withdrawal).findOne({
    order: { updatedAt: 'ASC' },
    where: {
      currency: In(platformCurrencies),
      status: WithdrawalStatus.UNSIGNED,
    },
  });

  if (!firstRecord) {
    return [];
  }

  const records = await manager.getRepository(Withdrawal).find({
    take: 100,
    order: { updatedAt: 'ASC' },
    where: {
      walletId: firstRecord.walletId,
      currency: firstRecord.currency,
      status: WithdrawalStatus.UNSIGNED,
    },
  });

  return records;
}
