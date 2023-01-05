import { EntityManager } from 'typeorm';
import { WalletEvent, DepositEvent } from '../Enums';
import { WalletBalance, Deposit } from '../entities';

import * as rawdb from './index';
import { Utils, Transaction } from 'sota-common';

export async function updateByCollectTransaction(
  manager: EntityManager,
  deposits: Deposit[],
  event: DepositEvent,
  tx: Transaction,
  isExternal: boolean = false
): Promise<WalletBalance> {
  throw new Error(`TODO: Revive me...`);
  /*
  const fee = tx.getNetworkFee();
  const outputs = tx.extractTransferOutputs();
  const amount = outputs[0].amount; // assume one output
  const depositCurrency = deposits[0].currency;
  const walletId = deposits[0].walletId;
  let walletLogEvent: WalletEvent;

  let balanceChange: string;
  const walletBalance = await manager.findOne(WalletBalance, {
    walletId,
  });

  if (!walletBalance) {
    throw new Error('walletBalance is not existed');
  }

  if (event === DepositEvent.COLLECTED_FAILED) {
    walletLogEvent = WalletEvent.COLLECTED_FAIL;
    balanceChange = '0';
  }

  if (event === DepositEvent.COLLECTED) {
    walletLogEvent = WalletEvent.COLLECTED;
    balanceChange = isExternal ? '-' + amount : '0';
  }

  const walletLogs = deposits.map(deposit => {
    return {
      walletId: walletBalance.walletId,
      currency: depositCurrency,
      balanceChange,
      event: walletLogEvent,
      refId: deposit.id,
    };
  });

  const token = getTokenBySymbol(depositCurrency);
  if (!token) {
    console.log('Cannot find currency configuration for ', depositCurrency);
    throw new Error('Cannot find currency configuration for ' + depositCurrency);
  }
  // find family of the currency to update fee
  const family = token.family;

  const collectFeeLogs = deposits.map(deposit => {
    return {
      walletId,
      currency: family,
      balanceChange: `-${fee}`,
      event: WalletEvent.COLLECT_FEE,
      refId: deposit.id,
    };
  });

  await Utils.PromiseAll([
    manager
      .createQueryBuilder()
      .update(WalletBalance)
      .set({
        balance: () => {
          return event === DepositEvent.COLLECTED && isExternal ? `balance - ${amount}` : `balance`;
        },
        updatedAt: Utils.nowInMillis(),
      })
      .where({
        walletId,
        currency: depositCurrency,
      })
      .execute(),
    manager
      .createQueryBuilder()
      .update(WalletBalance)
      .set({
        balance: () => {
          return event === DepositEvent.COLLECTED ? `balance - ${fee}` : `balance`;
        },
        updatedAt: Utils.nowInMillis(),
      })
      .where({
        walletId,
        currency: family,
      })
      .execute(),

    rawdb.insertWalletLog(manager, collectFeeLogs),
    rawdb.insertWalletLog(manager, walletLogs),
  ]);

  return null;
  */
}
