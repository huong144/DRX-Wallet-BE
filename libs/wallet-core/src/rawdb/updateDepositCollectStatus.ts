import { Utils } from 'sota-common';
import { Deposit, InternalTransfer } from '../entities';
import { EntityManager } from 'typeorm';
import { CollectStatus, DepositEvent } from '../Enums';
import { insertDepositLog } from './insertDepositLog';

export async function updateDepositCollectStatus(
  manager: EntityManager,
  transaction: InternalTransfer,
  status: CollectStatus
): Promise<void> {
  const records = await manager.find(Deposit, {
    collectedTxid: transaction.txid,
  });
  const tasks: Array<Promise<any>> = [];
  records.map(record => {
    tasks.push(
      insertDepositLog(
        manager,
        record.id,
        status === CollectStatus.COLLECTED ? DepositEvent.COLLECTED : DepositEvent.COLLECTED_FAILED,
        transaction.id
      )
    );
  });
  tasks.push(
    manager.update(
      Deposit,
      { collectedTxid: transaction.txid },
      { collectStatus: status, collectedTimestamp: transaction.updatedAt }
    )
  );
  await Utils.PromiseAll(tasks);
}
