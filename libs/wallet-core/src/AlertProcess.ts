import { BaseIntervalWorker, getLogger, Utils } from 'sota-common';
import { v1 as uuid } from 'uuid';
import { getConnection, EntityManager, LessThan, In, Not } from 'typeorm';
import { Withdrawal, Deposit, InternalTransfer } from './entities';
import { CollectStatus, WithdrawalStatus, NotCollect } from './Enums';
import { sendMailAlertPendingTooLong } from './hd_wallet';
const logger = getLogger('AlertProcess');
const waitingTime = 6 * 60 * 60 * 1000; // 6 hours
export class AlertProcess extends BaseIntervalWorker {
  protected _nextTickTimer: number = 30 * 60 * 1000; // 30 minutes
  protected readonly _id: string;
  constructor() {
    super();
    this._id = uuid();
  }
  protected async prepare(): Promise<void> {
    // Nothing to do...
  }
  protected async doProcess(): Promise<void> {
    return getConnection().transaction(async manager => {
      try {
        await this._doProcess(manager);
      } catch (e) {
        logger.error(`AlertProcess do process failed with error`);
        logger.error(e);
      }
    });
  }

  private async _doProcess(manager: EntityManager): Promise<void> {
    const [pendingWithdrawal, pendingInternalTransfer, pendingCollect] = await Promise.all([
      this._getAllPendingWithdrawal(manager),
      this._getAllPendingInternalTransfer(manager),
      this._getAllUnCollected(manager),
    ]);
    if (!pendingWithdrawal.length && !pendingInternalTransfer.length && !pendingCollect.length) {
      logger.info(`Do not have record pending too long`);
      return;
    }
    logger.info(`There are some records pending too long, send mail to operators`);
    await sendMailAlertPendingTooLong(pendingWithdrawal, pendingInternalTransfer, pendingCollect);
  }

  private async _getAllPendingInternalTransfer(manager: EntityManager): Promise<number[]> {
    const now = Utils.nowInMillis();
    const pendingInternalTransfers = await manager.getRepository(InternalTransfer).find({
      where: {
        status: Not(In([WithdrawalStatus.FAILED, WithdrawalStatus.COMPLETED])),
        createdAt: LessThan(now - waitingTime),
      },
    });
    return pendingInternalTransfers.map(_record => _record.id);
  }

  private async _getAllPendingWithdrawal(manager: EntityManager): Promise<number[]> {
    const now = Utils.nowInMillis();
    const pendingWithdrawals = await manager.getRepository(Withdrawal).find({
      where: {
        status: Not(In([WithdrawalStatus.FAILED, WithdrawalStatus.COMPLETED])),
        createdAt: LessThan(now - waitingTime),
      },
    });
    return pendingWithdrawals.map(_record => _record.id);
  }

  private async _getAllUnCollected(manager: EntityManager): Promise<number[]> {
    const now = Utils.nowInMillis();
    const pendingCollect = await manager.getRepository(Deposit).find({
      where: {
        collectStatus: In([CollectStatus.UNCOLLECTED, CollectStatus.COLLECTING, CollectStatus.SEED_REQUESTED]),
        collectedTxid: Not(In([NotCollect.DUST_AMOUNT])),
        createdAt: LessThan(now - waitingTime),
      },
    });
    return pendingCollect.map(_record => _record.id);
  }
}
