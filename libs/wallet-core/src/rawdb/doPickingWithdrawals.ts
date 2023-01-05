import { EntityManager } from 'typeorm';
import { IRawTransaction, Utils, getLogger } from 'sota-common';
import { HotWallet, WithdrawalTx, Withdrawal } from '../entities';
import { WithdrawalStatus, WithdrawalEvent } from '../Enums';
import * as rawdb from './index';

const logger = getLogger('doPickingWithdrawals');

/**
 * Update withdrawals and insert withdrawal tx by unsignedTx value
 *
 * @param manager
 * @param unsignedTx
 * @param hotWallet
 * @param withdrawalIds
 */
export async function doPickingWithdrawals(
  manager: EntityManager,
  unsignedTx: IRawTransaction,
  hotWallet: HotWallet,
  currency: string,
  withdrawalIds: number[]
): Promise<WithdrawalTx> {
  // Create withdrawal tx record
  const record = new WithdrawalTx();
  record.currency = currency;
  record.hotWalletAddress = hotWallet.address;
  record.status = WithdrawalStatus.SIGNING;
  record.unsignedRaw = unsignedTx.unsignedRaw;
  record.unsignedTxid = unsignedTx.txid;
  record.createdAt = Utils.nowInMillis();
  record.updatedAt = Utils.nowInMillis();

  const withdrawalTx = await rawdb.insertWithdrawalTx(manager, record);

  logger.info(`Created withdrawal_tx id=${withdrawalTx.id} currency=${currency} withdrawalIds=${withdrawalIds}`);

  // update withdrawal record
  const updatedValue = {
    withdrawalTxId: withdrawalTx.id,
    status: WithdrawalStatus.SIGNING,
    fromAddress: hotWallet.address,
    updatedAt: Utils.nowInMillis(),
  };

  await Utils.PromiseAll([
    manager.update(Withdrawal, withdrawalIds, updatedValue),
    rawdb.insertWithdrawalLogs(manager, withdrawalIds, WithdrawalEvent.PICKED, withdrawalTx.id, withdrawalTx.txid),
  ]);

  return withdrawalTx;
}

export default doPickingWithdrawals;
