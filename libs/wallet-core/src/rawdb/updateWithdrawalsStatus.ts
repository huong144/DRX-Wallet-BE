import { getLogger, Utils, ISubmittedTransaction } from 'sota-common';
import { Withdrawal } from '../entities';
import { EntityManager } from 'typeorm';
import insertWebhookProgress from './insertWebhookProgress';
import { WebhookType, WithdrawalEvent, WithdrawalStatus } from '../Enums';
import insertWithdrawalLog from './insertWithdrawalLog';

const logger = getLogger('rawdb::updateWithdrawalsTxStatus');

export async function updateWithdrawalsStatus(
  manager: EntityManager,
  withdrawalTxId: number,
  status: WithdrawalStatus,
  event: WithdrawalEvent,
  transactionResult?: ISubmittedTransaction,
  data?: string
): Promise<Withdrawal[]> {
  // Add note if it's not provided
  if (!data) {
    // The old tx is failed and need to be reconstructed
    if (status === WithdrawalStatus.UNSIGNED) {
      data = `withdrawal_tx_id=${withdrawalTxId}`;
    }
  }

  // Find wallet of record
  const records = await manager.find(Withdrawal, { withdrawalTxId });
  await Utils.PromiseAll(
    records.map(async record => {
      record.status = status;
      if (transactionResult) {
        if (transactionResult.hasOwnProperty('txid')) {
          record.txid = transactionResult.txid;
        }
      }

      const [newRecord] = await Utils.PromiseAll([
        manager.save(record),
        insertWebhookProgress(manager, record.userId, WebhookType.WITHDRAWAL, record.id, event),
      ]);

      return insertWithdrawalLog(manager, newRecord.txid, newRecord.id, event, data);
    })
  );

  return records;
}
