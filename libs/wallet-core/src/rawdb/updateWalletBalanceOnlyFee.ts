import { EntityManager } from 'typeorm';
import { WalletEvent, CollectStatus } from '../Enums';
import { WalletBalance } from '../entities';

import * as rawdb from './index';
import { Utils, CurrencyRegistry, BigNumber } from 'sota-common';
import { InternalTransfer } from '../entities/InternalTransfer';

export async function updateWalletBalanceOnlyFee(
  manager: EntityManager,
  transfer: InternalTransfer,
  status: CollectStatus,
  fee: BigNumber
): Promise<WalletBalance> {
  let balanceChange: string;
  const walletBalance = await manager.findOne(WalletBalance, {
    walletId: transfer.walletId,
  });

  if (!walletBalance) {
    throw new Error(`walletBalance id=${transfer.walletId} is not existed`);
  }

  if (status === CollectStatus.UNCOLLECTED) {
    balanceChange = '0';
  }

  if (status === CollectStatus.COLLECTED) {
    balanceChange = '-' + fee.toString();
  }

  const withdrawalFeeLog = {
    walletId: transfer.walletId,
    currency: transfer.currency,
    balanceChange,
    event: transfer.type,
    refId: transfer.id,
  };

  const currency = CurrencyRegistry.getOneCurrency(transfer.currency);
  const feeCurrency = currency.platform;

  await Utils.PromiseAll([
    manager
      .createQueryBuilder()
      .update(WalletBalance)
      .set({
        balance: () => {
          return status === CollectStatus.COLLECTED ? `balance - ${fee}` : `balance`;
        },
        updatedAt: Utils.nowInMillis(),
      })
      .where({
        walletId: transfer.walletId,
        currency: feeCurrency,
      })
      .execute(),

    rawdb.insertWalletLog(manager, withdrawalFeeLog),
  ]);

  return null;
}
